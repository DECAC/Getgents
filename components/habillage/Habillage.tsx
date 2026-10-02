"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ACCENTS_VIDEO,
  alignerMots,
  debutsDePhrases,
  decouperSousTitres,
  DUREE_CARTON,
  enveloppeMusique,
  LIBELLES_ETALONNAGE,
  LIBELLES_MUSIQUE,
  LIBELLES_SOUS_TITRES,
  niveauxParTrame,
  motsDuTexte,
  nomFichierHabille,
  reglagesValides,
  remplacerTexte,
  segmentsParole,
  STYLES_HABILLAGE,
  type Etalonnage,
  type PositionSousTitres,
  type ReglagesHabillage,
  type Segment,
  type SousTitre,
  type StyleMusique,
  type StyleSousTitres,
} from "@/lib/habillage";
import { choisirFormatVideo, debitVideo, formatDuree } from "@/lib/prompteur";
import { dessiner, filtreDisponible, POLICE, type DonneesRendu } from "./rendu";
import { genererMusique, preparerMusiqueImportee } from "./synthese";
import styles from "./Habillage.module.css";

/**
 * Habiller une capsule : sous-titres calés sur la voix, effets, musique.
 * Ouvert depuis la carte « Votre capsule est prête » du prompteur.
 *
 * Tout se passe dans le navigateur, comme l'enregistrement : la vidéo est
 * rejouée dans un canevas (`dessiner`), la voix et la musique sont mêlées
 * par Web Audio, et l'ensemble est réenregistré (MediaRecorder). L'export
 * se fait donc EN TEMPS RÉEL — une capsule d'une minute prend une minute —
 * et l'écran doit rester ouvert : un onglet caché n'anime plus le canevas.
 */

const CLE_MEMOIRE = "getgents:habillage";
const TEXTE_FIN_DEFAUT = "Merci d'avoir regardé !\nSuivez-moi pour les prochaines capsules";

type Onglet = "style" | "sousTitres" | "effets" | "musique";

interface Graphe {
  ctx: AudioContext;
  mix: GainNode;
  moniteur: GainNode;
  dest: MediaStreamAudioDestinationNode;
}

interface Exporte {
  url: string;
  blob: Blob;
  nom: string;
  taille: number;
  extension: string;
}

function lireMemoire(): { reglages: ReglagesHabillage; texteFin: string; styleId: string } {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_MEMOIRE) ?? "null") as Record<string, unknown> | null;
    if (brut) {
      return {
        reglages: reglagesValides(brut.reglages),
        texteFin: typeof brut.texteFin === "string" ? brut.texteFin : TEXTE_FIN_DEFAUT,
        styleId: typeof brut.styleId === "string" ? brut.styleId : "",
      };
    }
  } catch {
    // Stockage indisponible (navigation privée) : on part du premier style.
  }
  return { reglages: STYLES_HABILLAGE[0].reglages, texteFin: TEXTE_FIN_DEFAUT, styleId: STYLES_HABILLAGE[0].id };
}

/** Durée d'une vidéo de MediaRecorder : Chrome n'en écrit pas toujours (WebM). */
async function dureeDeLaVideo(v: HTMLVideoElement): Promise<number> {
  if (v.readyState < 1) await new Promise((r) => v.addEventListener("loadedmetadata", r, { once: true }));
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await new Promise<void>((r) => {
    const fini = () => {
      if (Number.isFinite(v.duration)) {
        v.removeEventListener("durationchange", fini);
        r();
      }
    };
    v.addEventListener("durationchange", fini);
    v.currentTime = 1e9;
    window.setTimeout(r, 3000);
  });
  const d = Number.isFinite(v.duration) ? v.duration : 0;
  v.currentTime = 0;
  return d;
}

function fichierDe(e: Exporte): File {
  return new File([e.blob], e.nom, { type: e.blob.type });
}

function partageable(e: Exporte): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [fichierDe(e)] });
  } catch {
    return false;
  }
}

export function Habillage({
  url,
  video: source,
  nom,
  texte,
  titre,
  onClose,
}: {
  url: string;
  video: Blob;
  nom: string;
  texte: string;
  titre: string;
  onClose: () => void;
}) {
  const memoire = useMemo(lireMemoire, []);
  const [reglages, setReglages] = useState<ReglagesHabillage>(memoire.reglages);
  const [styleId, setStyleId] = useState(memoire.styleId);
  const [texteFin, setTexteFin] = useState(memoire.texteFin);
  const [titreBandeau, setTitreBandeau] = useState(titre);
  const [onglet, setOnglet] = useState<Onglet>("style");

  const [analyse, setAnalyse] = useState<{ dureeVideo: number; segments: Segment[]; voixTrouvee: boolean } | null>(null);
  const [blocs, setBlocs] = useState<SousTitre[]>([]);
  const [decalage, setDecalage] = useState(0);
  // Dimensions RÉELLES de la prise : tant qu'on ne les connaît pas, pas d'export.
  const [dims, setDims] = useState<{ l: number; h: number } | null>(null);

  const [fichierMusique, setFichierMusique] = useState<{ nom: string; tampon: AudioBuffer } | null>(null);
  const [musique, setMusique] = useState<AudioBuffer | null>(null);
  const [musiqueEnCours, setMusiqueEnCours] = useState(false);

  const [lecture, setLecture] = useState(false);
  const [temps, setTempsEtat] = useState(0);
  const setTemps = useCallback((t: number) => {
    tempsRef.current = t;
    setTempsEtat(t);
  }, []);
  const [exportEnCours, setExportEnCours] = useState<number | null>(null);
  const [exporte, setExporte] = useState<Exporte | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canevasRef = useRef<HTMLCanvasElement>(null);
  const grapheRef = useRef<Graphe | null>(null);
  const musiqueSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const finVideoRef = useRef<number | null>(null);
  const enregistreurRef = useRef<MediaRecorder | null>(null);
  const dernierAffichageRef = useRef(0);
  // Position affichée, carton de fin compris (au-delà de la fin de la vidéo).
  const tempsRef = useRef(0);
  const exporteRef = useRef<Exporte | null>(null);

  const dureeVideo = analyse?.dureeVideo ?? 0;
  const dureeTotale = dureeVideo + (reglages.cartonFin ? DUREE_CARTON : 0);

  const donnees: DonneesRendu = useMemo(
    () => ({
      blocs,
      debuts: debutsDePhrases(blocs.flatMap((b) => b.mots)),
      dureeVideo,
      titre: titreBandeau,
      texteFin,
      decalage,
    }),
    [blocs, dureeVideo, titreBandeau, texteFin, decalage]
  );
  // La boucle d'animation lit toujours les DERNIERS réglages.
  const etatRef = useRef({ reglages, donnees, dureeTotale, musique });
  etatRef.current = { reglages, donnees, dureeTotale, musique };

  // --- Mémoire du style (par appareil) ---------------------------------------
  useEffect(() => {
    try {
      localStorage.setItem(CLE_MEMOIRE, JSON.stringify({ reglages, texteFin, styleId }));
    } catch {
      // sans mémoire, tant pis : le style se rechoisit
    }
  }, [reglages, texteFin, styleId]);

  // --- Analyse de la voix et calage du texte -----------------------------------
  const caler = useCallback(
    (segments: Segment[], duree: number) =>
      decouperSousTitres(alignerMots(motsDuTexte(texte), segments, duree)),
    [texte]
  );

  useEffect(() => {
    let annule = false;
    (async () => {
      const v = videoRef.current;
      let duree = 0;
      let segments: Segment[] = [];
      try {
        const Ctx =
          window.OfflineAudioContext ??
          (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
        const decode = await new Ctx(1, 1, 22050).decodeAudioData(await source.arrayBuffer());
        duree = decode.duration;
        segments = segmentsParole(niveauxParTrame(decode.getChannelData(0), decode.sampleRate));
      } catch {
        // Piste son illisible ici : le texte s'étalera sur toute la vidéo.
      }
      if (v) {
        if (!duree) duree = await dureeDeLaVideo(v);
      }
      if (annule) return;
      setAnalyse({ dureeVideo: duree, segments, voixTrouvee: segments.length > 0 });
      setBlocs(caler(segments, duree));
    })();
    void document.fonts?.load(`800 40px ${POLICE}`).catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [source, caler]);

  // Vécu sur iPhone : la piste son était analysée AVANT que la vidéo ne
  // livre ses dimensions — le canevas restait carré par défaut, et une prise
  // verticale y était écrasée. On les lit quand la vidéo les donne.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const lire = () => {
      if (!v.videoWidth || !v.videoHeight) return;
      setDims((d) => (d && d.l === v.videoWidth && d.h === v.videoHeight ? d : { l: v.videoWidth, h: v.videoHeight }));
    };
    lire();
    for (const e of ["loadedmetadata", "loadeddata", "resize"]) v.addEventListener(e, lire);
    return () => {
      for (const e of ["loadedmetadata", "loadeddata", "resize"]) v.removeEventListener(e, lire);
    };
  }, []);

  // --- Musique : régénérée quand le style ou le volume changent ---------------
  useEffect(() => {
    if (!analyse) return;
    if (reglages.musique === "aucune" || (reglages.musique === "importee" && !fichierMusique)) {
      setMusique(null);
      return;
    }
    let annule = false;
    const minuterie = window.setTimeout(async () => {
      setMusiqueEnCours(true);
      try {
        const enveloppe = enveloppeMusique(analyse.segments, dureeTotale, reglages.volumeMusique, reglages.attenuation);
        const tampon =
          reglages.musique === "importee" && fichierMusique
            ? await preparerMusiqueImportee(fichierMusique.tampon, dureeTotale, enveloppe)
            : await genererMusique(reglages.musique as Exclude<StyleMusique, "aucune" | "importee">, dureeTotale, enveloppe);
        if (!annule) setMusique(tampon);
      } catch {
        if (!annule) setMessage("La musique n'a pas pu être préparée sur ce navigateur.");
      } finally {
        if (!annule) setMusiqueEnCours(false);
      }
    }, 250);
    return () => {
      annule = true;
      window.clearTimeout(minuterie);
    };
  }, [analyse, reglages.musique, reglages.volumeMusique, reglages.attenuation, dureeTotale, fichierMusique]);

  // --- Dessin --------------------------------------------------------------------
  const dessinerA = useCallback((t: number) => {
    const c = canevasRef.current;
    const v = videoRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !v || !ctx) return;
    const { reglages: r, donnees: d } = etatRef.current;
    dessiner(ctx, v, c.width, c.height, t, r, d);
  }, []);

  // Image fixe redessinée à chaque retouche, hors lecture.
  useEffect(() => {
    if (!lecture && analyse) dessinerA(temps);
  }, [lecture, analyse, reglages, donnees, temps, dessinerA, dims]);

  // --- Son : voix de la vidéo + musique, mêlées ----------------------------------
  const graphe = useCallback((): Graphe | null => {
    if (grapheRef.current) return grapheRef.current;
    const v = videoRef.current;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!v || !Ctx) return null;
    const ctx = new Ctx();
    const mix = ctx.createGain();
    ctx.createMediaElementSource(v).connect(mix);
    // Limiteur : une voix forte plus la musique dépassaient le maximum, et le
    // son exporté saturait (crête mesurée à 1,00 sans lui).
    const limiteur = ctx.createDynamicsCompressor();
    limiteur.threshold.value = -3;
    limiteur.knee.value = 0;
    limiteur.ratio.value = 20;
    limiteur.attack.value = 0.003;
    limiteur.release.value = 0.1;
    mix.connect(limiteur);
    const moniteur = ctx.createGain();
    limiteur.connect(moniteur).connect(ctx.destination);
    const dest = ctx.createMediaStreamDestination();
    limiteur.connect(dest);
    grapheRef.current = { ctx, mix, moniteur, dest };
    return grapheRef.current;
  }, []);

  const arreterMusique = useCallback(() => {
    try {
      musiqueSourceRef.current?.stop();
    } catch {
      // déjà arrêtée
    }
    musiqueSourceRef.current = null;
  }, []);

  const lancerMusique = useCallback(
    (decalageLecture: number) => {
      arreterMusique();
      const g = grapheRef.current;
      const tampon = etatRef.current.musique;
      if (!g || !tampon || decalageLecture >= tampon.duration) return;
      const s = g.ctx.createBufferSource();
      s.buffer = tampon;
      s.connect(g.mix);
      s.start(0, decalageLecture);
      musiqueSourceRef.current = s;
    },
    [arreterMusique]
  );

  // Musique régénérée en pleine lecture : on enchaîne sans couper la vidéo.
  useEffect(() => {
    const v = videoRef.current;
    if (lecture && v && exportEnCours === null) lancerMusique(finVideoRef.current !== null ? dureeVideo : v.currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musique]);

  // --- Lecture -------------------------------------------------------------------
  const arreterBoucle = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const terminer = useCallback(() => {
    arreterBoucle();
    arreterMusique();
    videoRef.current?.pause();
    finVideoRef.current = null;
    setLecture(false);
    const rec = enregistreurRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, [arreterMusique]);

  const boucle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const { donnees: d, dureeTotale: total } = etatRef.current;
    const t = finVideoRef.current !== null ? d.dureeVideo + (performance.now() - finVideoRef.current) / 1000 : v.currentTime;
    dessinerA(t);
    const maintenant = performance.now();
    if (maintenant - dernierAffichageRef.current > 120) {
      dernierAffichageRef.current = maintenant;
      setTemps(t);
      if (enregistreurRef.current) setExportEnCours(Math.min(1, t / Math.max(total, 0.01)));
    }
    if (finVideoRef.current !== null && t >= total) {
      setTemps(Math.min(t, total));
      terminer();
      return;
    }
    rafRef.current = requestAnimationFrame(boucle);
  }, [dessinerA, terminer, setTemps]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const surFin = () => {
      if (etatRef.current.reglages.cartonFin) finVideoRef.current = performance.now();
      else terminer();
    };
    v.addEventListener("ended", surFin);
    return () => v.removeEventListener("ended", surFin);
  }, [terminer]);

  const lire = useCallback(async () => {
    const v = videoRef.current;
    const g = graphe();
    if (!v) return;
    void g?.ctx.resume();
    if (v.currentTime >= dureeVideo - 0.05 || finVideoRef.current !== null) v.currentTime = 0;
    finVideoRef.current = null;
    try {
      await v.play();
    } catch {
      setMessage("La lecture n'a pas pu démarrer : touchez ▶ à nouveau.");
      return;
    }
    lancerMusique(v.currentTime);
    setLecture(true);
    arreterBoucle();
    rafRef.current = requestAnimationFrame(boucle);
  }, [graphe, dureeVideo, lancerMusique, boucle]);

  const pause = useCallback(() => {
    arreterBoucle();
    arreterMusique();
    videoRef.current?.pause();
    finVideoRef.current = null;
    setLecture(false);
  }, [arreterMusique]);

  // Au-delà de la vidéo, on montre le carton de fin sur sa dernière image.
  const allerA = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (lecture) pause();
    v.currentTime = Math.min(t, Math.max(0, dureeVideo - 0.05));
    setTemps(Math.min(t, dureeTotale));
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const redessiner = () => {
      if (!rafRef.current) dessinerA(tempsRef.current);
    };
    v.addEventListener("seeked", redessiner);
    v.addEventListener("loadeddata", redessiner);
    return () => {
      v.removeEventListener("seeked", redessiner);
      v.removeEventListener("loadeddata", redessiner);
    };
  }, [dessinerA]);

  // --- Export --------------------------------------------------------------------
  const exporter = useCallback(async () => {
    const v = videoRef.current;
    const c = canevasRef.current as (HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }) | null;
    const g = graphe();
    if (!v || !c || !g) return;
    if (typeof MediaRecorder === "undefined" || !c.captureStream) {
      setMessage("Ce navigateur ne sait pas exporter de vidéo.");
      return;
    }
    const format = choisirFormatVideo((t) => MediaRecorder.isTypeSupported(t));
    if (!format) {
      setMessage("Aucun format vidéo disponible dans ce navigateur.");
      return;
    }
    void g.ctx.resume();
    pause();
    setMessage(null);
    v.currentTime = 0;
    await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
    const flux = new MediaStream([...c.captureStream(30).getVideoTracks(), ...g.dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(flux, {
      mimeType: format.mimeType,
      videoBitsPerSecond: debitVideo(c.width, c.height),
      audioBitsPerSecond: 160_000,
    });
    const morceaux: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) morceaux.push(e.data);
    };
    rec.onstop = () => {
      flux.getVideoTracks().forEach((t) => t.stop());
      enregistreurRef.current = null;
      g.moniteur.gain.value = 1;
      setExportEnCours(null);
      const blob = new Blob(morceaux, { type: format.mimeType.split(";")[0] });
      if (exporteRef.current) URL.revokeObjectURL(exporteRef.current.url);
      exporteRef.current = {
        url: URL.createObjectURL(blob),
        blob,
        nom: nomFichierHabille(nom, format.extension),
        taille: blob.size,
        extension: format.extension,
      };
      setExporte(exporteRef.current);
    };
    // L'export ne se fait pas entendre : on le regarde se faire, en silence.
    g.moniteur.gain.value = 0;
    enregistreurRef.current = rec;
    setExportEnCours(0);
    rec.start(1000);
    finVideoRef.current = null;
    try {
      await v.play();
    } catch {
      rec.onstop = null;
      rec.stop();
      enregistreurRef.current = null;
      g.moniteur.gain.value = 1;
      setExportEnCours(null);
      setMessage("L'export n'a pas pu démarrer : réessayez.");
      return;
    }
    lancerMusique(0);
    setLecture(true);
    arreterBoucle();
    rafRef.current = requestAnimationFrame(boucle);
  }, [graphe, pause, nom, lancerMusique, boucle]);

  const annulerExport = useCallback(() => {
    const rec = enregistreurRef.current;
    if (rec) {
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
    }
    enregistreurRef.current = null;
    if (grapheRef.current) grapheRef.current.moniteur.gain.value = 1;
    setExportEnCours(null);
    pause();
  }, [pause]);

  // Onglet caché pendant l'export : le canevas ne s'anime plus, la vidéo
  // exportée aurait des trous. On arrête, et on le dit.
  useEffect(() => {
    const surVisibilite = () => {
      if (document.hidden && enregistreurRef.current) {
        annulerExport();
        setMessage("Export interrompu : l'écran doit rester ouvert pendant l'export. Relancez-le.");
      }
    };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => document.removeEventListener("visibilitychange", surVisibilite);
  }, [annulerExport]);

  // Fermeture : tout s'arrête, la mémoire est rendue.
  useEffect(
    () => () => {
      arreterBoucle();
      try {
        musiqueSourceRef.current?.stop();
      } catch {
        // déjà arrêtée
      }
      const rec = enregistreurRef.current;
      if (rec) {
        rec.onstop = null;
        if (rec.state !== "inactive") rec.stop();
      }
      void grapheRef.current?.ctx.close().catch(() => undefined);
      if (exporteRef.current) URL.revokeObjectURL(exporteRef.current.url);
    },
    []
  );

  // --- Retouches -----------------------------------------------------------------
  const regler = <K extends keyof ReglagesHabillage>(cle: K, valeur: ReglagesHabillage[K]) =>
    setReglages((r) => ({ ...r, [cle]: valeur }));

  const choisirStyle = (id: string) => {
    const s = STYLES_HABILLAGE.find((x) => x.id === id);
    if (!s) return;
    setStyleId(id);
    // Une musique importée reste choisie : on ne jette pas un fichier ajouté exprès.
    setReglages(reglages.musique === "importee" && fichierMusique ? { ...s.reglages, musique: "importee" } : s.reglages);
  };

  const importerMusique = async (fichier: File | undefined) => {
    if (!fichier) return;
    try {
      const g = graphe();
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = g?.ctx ?? new Ctx();
      const tampon = await ctx.decodeAudioData(await fichier.arrayBuffer());
      setFichierMusique({ nom: fichier.name, tampon });
      regler("musique", "importee");
    } catch {
      setMessage("Ce fichier audio n'a pas pu être lu (MP3, M4A ou WAV conseillés).");
    }
  };

  const recaler = () => {
    if (!analyse) return;
    setBlocs(caler(analyse.segments, analyse.dureeVideo));
    setDecalage(0);
  };

  const enExport = exportEnCours !== null;
  const etiquetteStyle = STYLES_HABILLAGE.find((s) => s.id === styleId);
  const styleRetouche = etiquetteStyle && JSON.stringify(etiquetteStyle.reglages) !== JSON.stringify(reglages);
  const canevasPret = typeof document !== "undefined" && canevasRef.current?.getContext("2d");
  const sansEtalonnage = canevasPret ? !filtreDisponible(canevasPret) : false;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.voile} role="dialog" aria-label="Habiller la vidéo">
      <header className={styles.entete}>
        <span className={styles.titre}>✨ Habiller la vidéo</span>
        <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer l'habillage" disabled={enExport}>
          ×
        </button>
      </header>

      <div className={styles.corps}>
        <section className={styles.apercu}>
          <div className={styles.cadre} style={{ aspectRatio: dims ? `${dims.l} / ${dims.h}` : "9 / 16" }}>
            <canvas ref={canevasRef} className={styles.canevas} width={dims?.l ?? 1080} height={dims?.h ?? 1920} />
            {(!analyse || !dims) && <div className={styles.attente}>Écoute de la voix et calage des sous-titres…</div>}
          </div>
          {/* Source cachée : la vidéo est lue ici, dessinée dans le canevas. */}
          <video ref={videoRef} src={url} className={styles.cache} playsInline preload="auto" />
          <div className={styles.lecteur}>
            <button
              type="button"
              className={styles.bouton}
              onClick={() => (lecture ? pause() : void lire())}
              disabled={!analyse || enExport}
              aria-label={lecture ? "Pause" : "Lecture"}
            >
              {lecture && !enExport ? "❚❚" : "▶"}
            </button>
            <input
              type="range"
              className={styles.curseurTemps}
              min={0}
              max={Math.max(dureeTotale, 0.1)}
              step={0.05}
              value={Math.min(temps, dureeTotale)}
              onChange={(e) => allerA(parseFloat(e.target.value))}
              disabled={!analyse || enExport}
              aria-label="Position dans la vidéo"
            />
            <span className={styles.temps}>
              {formatDuree(Math.min(temps, dureeTotale))} / {formatDuree(dureeTotale)}
            </span>
          </div>

          {enExport ? (
            <div className={styles.export}>
              <div className={styles.jauge}>
                <span style={{ transform: `scaleX(${exportEnCours ?? 0})` }} />
              </div>
              <span className={styles.note}>
                Export en cours ({Math.round((exportEnCours ?? 0) * 100)} %) — gardez cet écran ouvert.
              </span>
              <button type="button" className={styles.bouton} onClick={annulerExport}>
                Annuler
              </button>
            </div>
          ) : (
            <div className={styles.export}>
              <button type="button" className={styles.principal} onClick={() => void exporter()} disabled={!analyse || !dims || musiqueEnCours}>
                Exporter la vidéo
              </button>
              <span className={styles.note}>
                {musiqueEnCours
                  ? "Préparation de la musique…"
                  : `Rendu en temps réel : environ ${formatDuree(dureeTotale)}. Rien ne quitte l'appareil.`}
              </span>
            </div>
          )}
          {message && (
            <p className={styles.message} role="status" onClick={() => setMessage(null)}>
              {message}
            </p>
          )}
        </section>

        <section className={styles.panneau} aria-disabled={enExport}>
          <nav className={styles.onglets} role="tablist">
            {(
              [
                ["style", "Style"],
                ["sousTitres", "Sous-titres"],
                ["effets", "Effets"],
                ["musique", "Musique"],
              ] as const
            ).map(([id, libelle]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={onglet === id}
                className={[styles.onglet, onglet === id ? styles.ongletActif : ""].filter(Boolean).join(" ")}
                onClick={() => setOnglet(id)}
              >
                {libelle}
              </button>
            ))}
          </nav>

          <fieldset className={styles.contenu} disabled={enExport}>
            {onglet === "style" && (
              <div className={styles.styles}>
                {STYLES_HABILLAGE.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={[styles.carteStyle, styleId === s.id ? styles.carteActive : ""].filter(Boolean).join(" ")}
                    onClick={() => choisirStyle(s.id)}
                    aria-pressed={styleId === s.id}
                  >
                    <span className={styles.vignetteStyle} data-style={s.reglages.sousTitres}>
                      <span style={{ color: ACCENTS_VIDEO.find((a) => a.id === s.reglages.accent)?.couleur }}>
                        {s.reglages.sousTitres === "motAMot" ? "IDÉE" : s.reglages.sousTitres === "classique" ? "Aa" : "MOT"}
                      </span>
                    </span>
                    <span className={styles.carteTexte}>
                      <b>
                        {s.libelle}
                        {styleId === s.id && styleRetouche ? " · retouché" : ""}
                      </b>
                      <span>{s.description}</span>
                      <span className={styles.carteMusique}>♪ {LIBELLES_MUSIQUE[s.reglages.musique]}</span>
                    </span>
                  </button>
                ))}
                <p className={styles.note}>Un style règle l&apos;image ET le son ; chaque onglet le retouche ensuite.</p>
              </div>
            )}

            {onglet === "sousTitres" && (
              <div className={styles.section}>
                <Choix
                  libelle="Style"
                  valeur={reglages.sousTitres}
                  options={Object.entries(LIBELLES_SOUS_TITRES) as [StyleSousTitres, string][]}
                  onChange={(v) => regler("sousTitres", v)}
                />
                {reglages.sousTitres !== "aucun" && (
                  <>
                    <Choix
                      libelle="Position"
                      valeur={reglages.position}
                      options={[
                        ["haut", "Haut"],
                        ["milieu", "Milieu"],
                        ["bas", "Bas"],
                      ] as [PositionSousTitres, string][]}
                      onChange={(v) => regler("position", v)}
                    />
                    <div className={styles.ligne}>
                      <span className={styles.libelle}>Couleur</span>
                      <span className={styles.pastilles}>
                        {ACCENTS_VIDEO.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={[styles.pastille, reglages.accent === a.id ? styles.pastilleActive : ""].filter(Boolean).join(" ")}
                            style={{ background: a.couleur }}
                            onClick={() => regler("accent", a.id)}
                            aria-label={a.libelle}
                            aria-pressed={reglages.accent === a.id}
                          />
                        ))}
                      </span>
                    </div>
                    <Interrupteur libelle="Texte en grand" valeur={reglages.grande} onChange={(v) => regler("grande", v)} />
                    <label className={styles.ligne}>
                      <span className={styles.libelle}>
                        Calage {decalage === 0 ? "" : decalage > 0 ? `(+${decalage.toFixed(1)} s)` : `(${decalage.toFixed(1)} s)`}
                      </span>
                      <input
                        type="range"
                        min={-1.5}
                        max={1.5}
                        step={0.1}
                        value={decalage}
                        onChange={(e) => setDecalage(parseFloat(e.target.value))}
                        aria-valuetext={`${decalage.toFixed(1)} secondes`}
                      />
                    </label>
                    <p className={styles.note}>
                      {analyse && !analyse.voixTrouvee
                        ? "Voix non détectée dans la piste son : le texte est réparti sur toute la vidéo. Ajustez le calage ou le texte ci-dessous."
                        : "Les sous-titres sont calés sur votre voix d'après le script. En avance : poussez le calage vers la droite ; en retard : vers la gauche."}
                    </p>
                    <div className={styles.liste}>
                      {blocs.map((b, i) => (
                        <label key={i} className={styles.bloc}>
                          <span className={styles.blocTemps}>{formatDuree(b.debut)}</span>
                          <input
                            className={styles.champ}
                            value={b.mots.map((m) => m.mot).join(" ")}
                            onChange={(e) => setBlocs((tous) => tous.map((x, j) => (j === i ? remplacerTexte(x, e.target.value) : x)))}
                            onFocus={() => allerA(b.debut + decalage + 0.05)}
                            aria-label={`Sous-titre ${i + 1}`}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" className={styles.lien} onClick={recaler}>
                      Revenir au texte du script
                    </button>
                  </>
                )}
              </div>
            )}

            {onglet === "effets" && (
              <div className={styles.section}>
                <Interrupteur
                  libelle="Zooms au rythme des phrases"
                  aide="Une phrase sur deux, l'image se resserre : la relance des vidéos courtes."
                  valeur={reglages.zooms}
                  onChange={(v) => regler("zooms", v)}
                />
                <Choix
                  libelle="Couleurs"
                  valeur={reglages.etalonnage}
                  options={Object.entries(LIBELLES_ETALONNAGE) as [Etalonnage, string][]}
                  onChange={(v) => regler("etalonnage", v)}
                />
                {sansEtalonnage && <p className={styles.note}>Ce navigateur ne sait pas modifier les couleurs : l&apos;image restera naturelle.</p>}
                <Interrupteur
                  libelle="Barre de progression"
                  valeur={reglages.progression}
                  onChange={(v) => regler("progression", v)}
                />
                <Interrupteur libelle="Titre en haut" valeur={reglages.bandeauTitre} onChange={(v) => regler("bandeauTitre", v)} />
                {reglages.bandeauTitre && (
                  <input
                    className={styles.champ}
                    value={titreBandeau}
                    onChange={(e) => setTitreBandeau(e.target.value)}
                    maxLength={80}
                    aria-label="Titre affiché en haut"
                  />
                )}
                <Interrupteur
                  libelle={`Carton de fin (+${DUREE_CARTON.toString().replace(".", ",")} s)`}
                  valeur={reglages.cartonFin}
                  onChange={(v) => regler("cartonFin", v)}
                />
                {reglages.cartonFin && (
                  <textarea
                    className={styles.champ}
                    value={texteFin}
                    onChange={(e) => setTexteFin(e.target.value)}
                    rows={2}
                    maxLength={140}
                    aria-label="Texte du carton de fin"
                  />
                )}
              </div>
            )}

            {onglet === "musique" && (
              <div className={styles.section}>
                <div className={styles.puces}>
                  {(["aucune", "inspirant", "energique", "lofi", "corporate"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={[styles.puce, reglages.musique === m ? styles.puceActive : ""].filter(Boolean).join(" ")}
                      onClick={() => regler("musique", m)}
                      aria-pressed={reglages.musique === m}
                    >
                      {LIBELLES_MUSIQUE[m]}
                    </button>
                  ))}
                  <label className={[styles.puce, reglages.musique === "importee" ? styles.puceActive : ""].filter(Boolean).join(" ")}>
                    {fichierMusique ? `♪ ${fichierMusique.nom}` : "Importer ma musique…"}
                    <input
                      type="file"
                      accept="audio/*"
                      className={styles.cache}
                      onChange={(e) => void importerMusique(e.target.files?.[0])}
                    />
                  </label>
                  {fichierMusique && reglages.musique !== "importee" && (
                    <button type="button" className={styles.puce} onClick={() => regler("musique", "importee")}>
                      Reprendre {fichierMusique.nom}
                    </button>
                  )}
                </div>
                {reglages.musique !== "aucune" && (
                  <>
                    <label className={styles.ligne}>
                      <span className={styles.libelle}>Volume</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={reglages.volumeMusique}
                        onChange={(e) => regler("volumeMusique", parseFloat(e.target.value))}
                      />
                    </label>
                    <Interrupteur
                      libelle="Baisser la musique quand je parle"
                      valeur={reglages.attenuation}
                      onChange={(v) => regler("attenuation", v)}
                    />
                  </>
                )}
                <p className={styles.note}>
                  Les musiques proposées sont composées par Getgents à chaque export : libres de droits,
                  elles ne risquent pas de rendre la vidéo muette sur LinkedIn. Une musique importée
                  doit l&apos;être aussi — vous en portez les droits.
                </p>
              </div>
            )}
          </fieldset>
        </section>
      </div>

      {exporte && (
        <div className={styles.resultat} role="dialog" aria-label="Vidéo habillée">
          <div className={styles.carte}>
            <h2 className={styles.carteTitre}>Votre vidéo habillée est prête</h2>
            <video className={styles.lectureFinale} src={exporte.url} controls playsInline />
            <div className={styles.actions}>
              <a className={styles.principal} href={exporte.url} download={exporte.nom}>
                Télécharger ({exporte.extension.toUpperCase()}, {(exporte.taille / 1_048_576).toFixed(1).replace(".", ",")} Mo)
              </a>
              {partageable(exporte) && (
                <button
                  type="button"
                  className={styles.bouton}
                  onClick={() => void navigator.share({ files: [fichierDe(exporte)], title: exporte.nom }).catch(() => undefined)}
                >
                  Enregistrer / partager
                </button>
              )}
              <button type="button" className={styles.bouton} onClick={() => setExporte(null)}>
                Retoucher
              </button>
            </div>
            <p className={styles.note}>
              Téléchargez-la avant de fermer : comme la prise d&apos;origine, elle n&apos;existe que sur cet appareil.
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function Choix<T extends string>({
  libelle,
  valeur,
  options,
  onChange,
}: {
  libelle: string;
  valeur: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.ligneHaute}>
      <span className={styles.libelle}>{libelle}</span>
      <span className={styles.puces}>
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={[styles.puce, valeur === v ? styles.puceActive : ""].filter(Boolean).join(" ")}
            onClick={() => onChange(v)}
            aria-pressed={valeur === v}
          >
            {l}
          </button>
        ))}
      </span>
    </div>
  );
}

function Interrupteur({
  libelle,
  aide,
  valeur,
  onChange,
}: {
  libelle: string;
  aide?: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={styles.ligne}>
      <span className={styles.libelle}>
        {libelle}
        {aide && <small className={styles.aide}>{aide}</small>}
      </span>
      <input type="checkbox" className={styles.interrupteur} checked={valeur} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

