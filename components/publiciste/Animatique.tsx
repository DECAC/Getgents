"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StudioPubliciste.module.css";
import { minutage, type Scene } from "@/lib/publicisteStoryboard";

/**
 * L'animatique de la maquette : les croquis défilent (fondu, léger zoom), la
 * voix dit chaque réplique sur SA scène, la musique boucle dessous et
 * s'efface quand la voix parle. Tout se joue dans le navigateur (Web Audio) ;
 * une scène s'allonge si sa réplique est plus longue que prévu (`minutage`).
 * Tout calque plein écran porte sa propre sortie : Fermer, et Échap.
 */
export function Animatique({
  scenes,
  croquis,
  voix,
  musique,
  info,
  fermer,
}: {
  scenes: Scene[];
  croquis: (string | null)[];
  voix: (string | null)[];
  musique: string | null;
  info: string;
  fermer: () => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [st, setSt] = useState("Chargement…");
  const [fil, setFil] = useState(0);
  const [pause, setPause] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let fini = false;
    let raf = 0;
    const sources: AudioScheduledSourceNode[] = [];
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const actx = Ctx ? new Ctx() : null;
    ctxRef.current = actx;

    const tampon = async (url: string | null): Promise<AudioBuffer | null> => {
      if (!url || !actx) return null;
      try {
        const ab = await fetch(url).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.arrayBuffer();
        });
        return await actx.decodeAudioData(ab);
      } catch {
        return null;
      }
    };
    const image = (src: string | null) =>
      new Promise<HTMLImageElement | null>((ok) => {
        if (!src) return ok(null);
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => ok(null);
        i.src = src;
      });

    (async () => {
      try {
        await actx?.resume();
      } catch {
        /* sans son : les images défilent quand même */
      }
      const [imgs, tv, tm] = await Promise.all([Promise.all(croquis.map(image)), Promise.all(voix.map(tampon)), tampon(musique)]);
      if (fini) return;
      const plan = minutage(scenes, tv.map((b) => (b ? b.duration : null)));
      const total = plan.length ? plan[plan.length - 1].fin : 0;
      const c = toile.current;
      if (!c) return;
      const g = c.getContext("2d")!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;

      const T0 = actx ? actx.currentTime + 0.15 : 0;
      const debut = performance.now() + 150;
      if (actx) {
        const sortie = actx.createGain();
        sortie.connect(actx.destination);
        tv.forEach((b, i) => {
          if (!b || plan[i].voix == null) return;
          const s = actx.createBufferSource();
          s.buffer = b;
          s.connect(sortie);
          s.start(T0 + plan[i].voix!);
          sources.push(s);
        });
        if (tm) {
          // La musique boucle sous la voix et s'efface quand elle parle.
          const gm = actx.createGain();
          gm.connect(sortie);
          gm.gain.setValueAtTime(0, T0);
          gm.gain.linearRampToValueAtTime(0.5, T0 + 1);
          tv.forEach((b, i) => {
            const t = plan[i].voix;
            if (!b || t == null) return;
            gm.gain.setTargetAtTime(0.22, T0 + t - 0.2, 0.12);
            gm.gain.setTargetAtTime(0.5, T0 + t + b.duration + 0.2, 0.3);
          });
          gm.gain.setTargetAtTime(0.0001, T0 + Math.max(0, total - 2), 0.6);
          const m = actx.createBufferSource();
          m.buffer = tm;
          m.loop = true;
          m.connect(gm);
          m.start(T0);
          m.stop(T0 + total + 0.5);
          sources.push(m);
        }
      }
      const temps = () => (actx ? actx.currentTime - T0 : (performance.now() - debut) / 1000);
      const dessiner = (src: HTMLImageElement | null, alpha: number, zoom: number) => {
        if (!src) return;
        const W = c.width;
        const H = c.height;
        const s = Math.min(W / src.width, H / src.height) * 0.94 * zoom;
        g.globalAlpha = alpha;
        g.drawImage(src, (W - src.width * s) / 2, (H - src.height * s) / 2, src.width * s, src.height * s);
        g.globalAlpha = 1;
      };
      const boucle = () => {
        if (fini) return;
        const t = Math.max(0, temps());
        g.fillStyle = "#0f0c0a";
        g.fillRect(0, 0, c.width, c.height);
        const i = Math.max(0, plan.findIndex((p) => t >= p.debut && t < p.fin));
        const p = plan[i];
        const k = (t - p.debut) / (p.fin - p.debut);
        if (i > 0 && t - p.debut < 0.5) dessiner(imgs[i - 1], 1, 1.04);
        dessiner(imgs[i], i === 0 ? 1 : Math.min(1, (t - p.debut) / 0.5), 1 + 0.04 * Math.min(1, k));
        if (!imgs[i]) {
          g.fillStyle = "#cfc4bc";
          g.font = `${16 * dpr}px system-ui, sans-serif`;
          g.textAlign = "center";
          g.fillText(`${i + 1}. ${scenes[i].titre}`, c.width / 2, c.height / 2);
        }
        const dit = tv[i] && p.voix != null && t >= p.voix && t < p.voix + tv[i]!.duration + 0.5;
        setSt(dit ? scenes[i].vo : `${i + 1}. ${scenes[i].titre}`);
        setFil(Math.min(100, (t / total) * 100));
        if (t >= total + 0.5) return fermer();
        raf = requestAnimationFrame(boucle);
      };
      boucle();
    })();

    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => {
      fini = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", touche);
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* déjà arrêtée */
        }
      }
      void actx?.close();
    };
    // Jouée une fois, à l'ouverture : les données ne changent pas pendant la lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculer = () => {
    const a = ctxRef.current;
    if (!a) return;
    if (a.state === "running") {
      void a.suspend();
      setPause(true);
    } else {
      void a.resume();
      setPause(false);
    }
  };

  return (
    <div className={styles.animatique} role="dialog" aria-modal="true" aria-label="Animatique">
      <canvas ref={toile} aria-hidden="true" />
      <div className={styles.anHaut}>
        <span>
          <b>Animatique</b> <span className={styles.mono}>{info}</span>
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={basculer}>
            {pause ? "Reprendre" : "Pause"}
          </button>
          <button type="button" onClick={fermer} autoFocus>
            Fermer
          </button>
        </span>
      </div>
      <p className={styles.anSt} aria-live="polite">
        {st}
      </p>
      <div className={styles.anFil}>
        <i style={{ width: `${fil}%` }} />
      </div>
    </div>
  );
}

/** La visionneuse de la maquette : un croquis en grand, précédente / suivante, Échap. */
export function Visionneuse({ scenes, src, index, aller, fermer }: { scenes: Scene[]; src: (i: number) => string | null; index: number; aller: (i: number) => void; fermer: () => void }) {
  const n = scenes.length;
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
      else if (e.key === "ArrowLeft") aller((index - 1 + n) % n);
      else if (e.key === "ArrowRight") aller((index + 1) % n);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [index, n, aller, fermer]);
  const s = scenes[index];
  const url = src(index);
  return (
    <div
      className={styles.visionneuse}
      role="dialog"
      aria-modal="true"
      aria-label="Croquis agrandi"
      onClick={(e) => {
        if (e.target === e.currentTarget) fermer();
      }}
    >
      <div className={styles.vHaut}>
        <span className={styles.mono} style={{ color: "#cfc4bc" }}>
          Scène {index + 1} sur {n}
        </span>
        <button type="button" onClick={fermer} autoFocus>
          Fermer
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={`Croquis de la scène ${index + 1} : ${s.titre}`} /> : <span />}
      <div className={styles.vHaut}>
        <button type="button" aria-label="Scène précédente" onClick={() => aller((index - 1 + n) % n)}>
          ‹ Précédente
        </button>
        <span className={styles.vLegende}>{s.titre}</span>
        <button type="button" aria-label="Scène suivante" onClick={() => aller((index + 1) % n)}>
          Suivante ›
        </button>
      </div>
    </div>
  );
}
