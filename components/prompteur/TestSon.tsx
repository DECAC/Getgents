"use client";

import { useEffect, useRef, useState } from "react";
import { choisirFormatAudio, DUREE_TEST_SON_MS, niveauAffiche, verdictSon } from "@/lib/prompteur";
import styles from "./Prompteur.module.css";

type Verdict = ReturnType<typeof verdictSon>;

/**
 * Test son des réglages ⚙ : un vu-mètre en continu, et une phrase enregistrée
 * puis rejouée. Il sert à choisir le micro (micro-cravate ou micro intégré ?)
 * AVANT une prise : le vu-mètre dit si le micro choisi capte, l'écoute dit
 * comment il sonne. Même piste que la vidéo, donc mêmes traitements
 * (réduction de bruit, gain) : ce qu'on entend est ce que la capsule aura.
 * Rien ne quitte le navigateur.
 */
export function TestSon({ flux, desactive }: { flux: MediaStream | null; desactive: boolean }) {
  const piste = flux?.getAudioTracks()[0] ?? null;
  const barreRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mesureRef = useRef({ actif: false, max: 0, crete: 0 });
  const enregistreurRef = useRef<MediaRecorder | null>(null);
  const minuteriesRef = useRef<number[]>([]);
  const urlRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<"repos" | "ecoute" | "pret">("repos");
  const [reste, setReste] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Vu-mètre : écrit directement dans le style, sans rendu React à chaque image.
  // La « barre » est le CACHE posé sur le dégradé : il rétrécit quand le son monte.
  useEffect(() => {
    if (!piste) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const contexte = new Ctx();
    void contexte.resume().catch(() => undefined);
    const analyseur = contexte.createAnalyser();
    analyseur.fftSize = 1024;
    const source = contexte.createMediaStreamSource(new MediaStream([piste]));
    source.connect(analyseur);
    const tampon = new Float32Array(analyseur.fftSize);
    let lisse = 0;
    let rafale = 0;
    const pas = () => {
      analyseur.getFloatTimeDomainData(tampon);
      let somme = 0;
      let crete = 0;
      for (let k = 0; k < tampon.length; k++) {
        const v = tampon[k];
        somme += v * v;
        if (Math.abs(v) > crete) crete = Math.abs(v);
      }
      const niveau = niveauAffiche(Math.sqrt(somme / tampon.length));
      // Monte tout de suite, redescend doucement : l'œil suit la voix.
      lisse = niveau > lisse ? niveau : lisse * 0.9 + niveau * 0.1;
      const m = mesureRef.current;
      if (m.actif) {
        m.max = Math.max(m.max, niveau);
        m.crete = Math.max(m.crete, crete);
      }
      if (barreRef.current) barreRef.current.style.transform = `scaleX(${(1 - lisse).toFixed(3)})`;
      rafale = requestAnimationFrame(pas);
    };
    rafale = requestAnimationFrame(pas);
    return () => {
      cancelAnimationFrame(rafale);
      source.disconnect();
      void contexte.close().catch(() => undefined);
      if (barreRef.current) barreRef.current.style.transform = "scaleX(1)";
    };
  }, [piste]);

  // Réglages refermés en plein test : on arrête tout et on rend la mémoire.
  useEffect(
    () => () => {
      minuteriesRef.current.forEach((t) => window.clearTimeout(t));
      const enr = enregistreurRef.current;
      if (enr && enr.state !== "inactive") {
        enr.onstop = null;
        enr.stop();
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  // L'écoute part d'elle-même ; si le navigateur la bloque, « Réécouter » reste.
  useEffect(() => {
    if (phase === "pret" && url) void audioRef.current?.play().catch(() => undefined);
  }, [phase, url]);

  const arreter = () => {
    minuteriesRef.current.forEach((t) => window.clearTimeout(t));
    minuteriesRef.current = [];
    const enr = enregistreurRef.current;
    if (enr && enr.state !== "inactive") enr.stop();
  };

  const tester = () => {
    if (!piste) return;
    if (typeof MediaRecorder === "undefined") {
      setErreur("Ce navigateur ne sait pas enregistrer le son : fiez-vous au vu-mètre.");
      return;
    }
    const type = choisirFormatAudio((t) => MediaRecorder.isTypeSupported(t));
    let enr: MediaRecorder;
    try {
      enr = new MediaRecorder(new MediaStream([piste]), type ? { mimeType: type } : undefined);
    } catch {
      setErreur("Ce navigateur ne sait pas enregistrer le son : fiez-vous au vu-mètre.");
      return;
    }
    const morceaux: Blob[] = [];
    enr.ondataavailable = (e) => {
      if (e.data.size) morceaux.push(e.data);
    };
    enr.onstop = () => {
      enregistreurRef.current = null;
      mesureRef.current.actif = false;
      const blob = new Blob(morceaux, { type: enr.mimeType || type || "audio/webm" });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = blob.size ? URL.createObjectURL(blob) : null;
      setUrl(urlRef.current);
      setVerdict(verdictSon(mesureRef.current.max, mesureRef.current.crete));
      setPhase("pret");
    };
    audioRef.current?.pause();
    setErreur(null);
    setVerdict(null);
    mesureRef.current = { actif: true, max: 0, crete: 0 };
    enregistreurRef.current = enr;
    enr.start();
    setPhase("ecoute");
    const secondes = Math.round(DUREE_TEST_SON_MS / 1000);
    setReste(secondes);
    minuteriesRef.current = [
      ...Array.from({ length: secondes - 1 }, (_, i) => window.setTimeout(() => setReste(secondes - 1 - i), (i + 1) * 1000)),
      window.setTimeout(arreter, DUREE_TEST_SON_MS),
    ];
  };

  const ecouter = () => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  };

  return (
    <div className={styles.testSon}>
      <span className={styles.libelle}>Son</span>
      <span className={styles.vumetre} aria-hidden="true" title="Niveau du micro choisi">
        <span ref={barreRef} className={styles.vumetreBarre} />
      </span>
      {phase === "ecoute" ? (
        <button type="button" className={[styles.bouton, styles.boutonActif].join(" ")} onClick={arreter} aria-live="polite">
          ■ Parlez… {reste} s
        </button>
      ) : (
        <button
          type="button"
          className={styles.bouton}
          onClick={tester}
          disabled={!piste || desactive}
          title={piste ? "Enregistre une phrase, puis la rejoue" : "Activez d'abord la caméra et le micro"}
        >
          {url ? "↻ Refaire le test" : "🎙 Tester le son"}
        </button>
      )}
      {phase === "pret" && url && (
        <button type="button" className={styles.bouton} onClick={ecouter}>
          ▶ Réécouter
        </button>
      )}
      <audio ref={audioRef} src={url ?? undefined} playsInline preload="auto" className={styles.canevas} />
      {(erreur || verdict || !piste) && (
        <span
          className={[styles.verdict, verdict && !erreur ? styles[`verdict_${verdict.ton}`] : ""].filter(Boolean).join(" ")}
          role="status"
        >
          {erreur ?? verdict?.texte ?? "Activez la caméra pour tester le micro."}
        </span>
      )}
    </div>
  );
}
