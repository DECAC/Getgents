"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  alignerPosition,
  CADRAGES,
  choisirFormatVideo,
  decouperScript,
  DUREE_PAR_DEFAUT,
  dureeEstimee,
  formatDuree,
  motsEntendus,
  MOTS_PAR_MINUTE,
  nomFichierCapsule,
  rectangleCadrage,
  type Cadrage,
} from "@/lib/prompteur";
import styles from "./Prompteur.module.css";

/**
 * Le prompteur : le texte défile au rythme de la voix, la caméra enregistre.
 *
 * Trois façons d'avancer :
 *   - « voix » : la reconnaissance vocale du navigateur transcrit, et
 *     `alignerPosition` retrouve où l'on en est dans le texte. Le vrai suivi ;
 *   - « rythme » : sans transcription — le texte avance quand on parle, à la
 *     vitesse réglée, et s'arrête quand on se tait (niveau du micro). Repli
 *     automatique quand la reconnaissance manque ou échoue ;
 *   - « auto » : défilement régulier, comme un prompteur classique.
 *
 * La vidéo est enregistrée dans le navigateur (MediaRecorder), recadrée au
 * format choisi par un canevas, et téléchargée : rien ne part au serveur.
 * L'aperçu de la caméra est une vignette : le texte, lui, occupe l'écran, en
 * haut — au plus près de l'objectif, pour que le regard ne décroche pas.
 */

type Suivi = "voix" | "rythme" | "auto";
type Etat = "pret" | "decompte" | "enregistre" | "termine";

interface Resultat {
  url: string;
  blob: Blob;
  taille: number;
  extension: string;
  nom: string;
}

/** Hauteur de la ligne de lecture, en part de la zone de texte : près de la caméra. */
const ANCRE = 0.26;

function fichierDe(r: Resultat): File {
  return new File([r.blob], r.nom, { type: r.blob.type || "video/mp4" });
}

function partageable(r: Resultat): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [fichierDe(r)] });
  } catch {
    return false;
  }
}

async function partager(r: Resultat) {
  try {
    await navigator.share({ files: [fichierDe(r)], title: r.nom });
  } catch {
    // Partage annulé par l'utilisateur : rien à signaler.
  }
}

type ReconnaissanceVocale = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function constructeurReconnaissance(): (new () => ReconnaissanceVocale) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => ReconnaissanceVocale) | null;
}

export function Prompteur({
  titre,
  texte,
  dureeCible = DUREE_PAR_DEFAUT,
  onClose,
}: {
  titre: string;
  texte: string;
  dureeCible?: number;
  onClose: () => void;
}) {
  const mots = useMemo(() => decouperScript(texte), [texte]);
  const norms = useMemo(() => mots.map((m) => m.norm), [mots]);
  const paragraphes = useMemo(() => {
    const groupes: { index: number; mot: string }[][] = [];
    mots.forEach((m, index) => {
      (groupes[m.paragraphe] ??= []).push({ index, mot: m.mot });
    });
    return groupes.filter(Boolean);
  }, [mots]);

  const reconnaissanceDisponible = useMemo(() => !!constructeurReconnaissance(), []);
  const [suivi, setSuivi] = useState<Suivi>(() => (constructeurReconnaissance() ? "voix" : "rythme"));
  const [vitesse, setVitesse] = useState(MOTS_PAR_MINUTE);
  const [taille, setTaille] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 700 ? 28 : 42
  );
  const [cadrage, setCadrage] = useState<Cadrage>(() =>
    typeof window !== "undefined" && window.innerHeight > window.innerWidth ? "vertical" : "carre"
  );

  const [position, setPositionEtat] = useState(0);
  const positionRef = useRef(0);
  const setPosition = useCallback((p: number) => {
    positionRef.current = p;
    setPositionEtat(p);
  }, []);
  const [defile, setDefile] = useState(false);
  const [parle, setParle] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [erreurCamera, setErreurCamera] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>("pret");
  const [decompte, setDecompte] = useState(0);
  const [ecoule, setEcoule] = useState(0);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canevasRef = useRef<HTMLCanvasElement>(null);
  const colonneRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [decalage, setDecalage] = useState(0);
  const [largeur, setLargeur] = useState(0);
  const enregistreurRef = useRef<MediaRecorder | null>(null);
  const dessinRef = useRef<number | null>(null);
  const minuteriesRef = useRef<number[]>([]);
  const resultatRef = useRef<Resultat | null>(null);
  resultatRef.current = resultat;
  const fluxRef = useRef<MediaStream | null>(null);
  fluxRef.current = flux;

  const courant = Math.min(Math.floor(position), mots.length);
  const fini = courant >= mots.length;

  // --- Caméra et micro ------------------------------------------------------

  const activerCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (fluxRef.current) return fluxRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreurCamera("Ce navigateur ne donne pas accès à la caméra.");
      return null;
    }
    try {
      const f = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setErreurCamera(null);
      setFlux(f);
      return f;
    } catch (e) {
      const nom = (e as Error).name;
      setErreurCamera(
        nom === "NotAllowedError"
          ? "Caméra et micro refusés. Autorisez-les dans les réglages du site pour enregistrer — le texte, lui, défile quand même."
          : nom === "NotFoundError"
            ? "Aucune caméra trouvée sur cet appareil."
            : "La caméra n'a pas pu démarrer."
      );
      return null;
    }
  }, []);

  // Demandée à l'ouverture : on vient pour tourner.
  useEffect(() => {
    void activerCamera();
  }, [activerCamera]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && flux && v.srcObject !== flux) {
      v.srcObject = flux;
      void v.play().catch(() => undefined);
    }
  }, [flux, resultat]);

  // L'écran d'un téléphone ne s'éteint pas en pleine lecture.
  useEffect(() => {
    let verrou: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((v) => (verrou = v))
      .catch(() => undefined);
    return () => void verrou?.release().catch(() => undefined);
  }, []);

  // --- Défilement ------------------------------------------------------------

  // La ligne du mot courant se cale sur la ligne de lecture.
  useLayoutEffect(() => {
    const colonne = colonneRef.current;
    const zone = zoneRef.current;
    if (!colonne || !zone) return;
    const cible = colonne.querySelector<HTMLElement>(`[data-i="${Math.min(courant, mots.length - 1)}"]`);
    if (!cible) return;
    setDecalage(zone.clientHeight * ANCRE - cible.offsetTop);
  }, [courant, mots.length, taille, largeur]);

  // Le texte se recompose quand la fenêtre change : la ligne courante aussi.
  useEffect(() => {
    const surRedim = () => setLargeur(window.innerWidth);
    window.addEventListener("resize", surRedim);
    return () => window.removeEventListener("resize", surRedim);
  }, []);

  // Fin du texte : on s'arrête de défiler (l'enregistrement, lui, continue).
  useEffect(() => {
    if (fini && defile) setDefile(false);
  }, [fini, defile]);

  // « auto » et « rythme » : avance continue, à la vitesse réglée.
  useEffect(() => {
    if (!defile || suivi === "voix") return;
    let dernier = performance.now();
    let rafale = 0;
    let plancher = 0.01;
    let finParole = 0;
    let contexte: AudioContext | null = null;
    let analyseur: AnalyserNode | null = null;
    let micPropre: MediaStream | null = null;
    let annule = false;
    const tampon = new Float32Array(1024);

    async function brancherMicro() {
      const source = fluxRef.current?.getAudioTracks().length
        ? fluxRef.current
        : await navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => null);
      if (!source || annule) return;
      if (source !== fluxRef.current) micPropre = source;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      contexte = new Ctx();
      void contexte.resume().catch(() => undefined);
      analyseur = contexte.createAnalyser();
      analyseur.fftSize = 1024;
      contexte.createMediaStreamSource(source).connect(analyseur);
    }
    if (suivi === "rythme") void brancherMicro();

    const pas = (maintenant: number) => {
      const dt = Math.min(maintenant - dernier, 100);
      dernier = maintenant;
      let avance = suivi === "auto";
      if (suivi === "rythme" && analyseur) {
        analyseur.getFloatTimeDomainData(tampon);
        let somme = 0;
        for (let k = 0; k < tampon.length; k++) somme += tampon[k] * tampon[k];
        const niveau = Math.sqrt(somme / tampon.length);
        // Plancher de bruit appris en continu : la pièce la plus calme comme
        // la plus bruyante déclenchent au bon niveau.
        if (niveau < plancher * 1.5) plancher = plancher * 0.97 + niveau * 0.03;
        if (niveau > Math.max(0.015, plancher * 3)) finParole = maintenant + 350;
        avance = maintenant < finParole;
        setParle(avance);
      }
      if (avance) setPosition(Math.min(positionRef.current + (dt * vitesse) / 60000, mots.length));
      rafale = requestAnimationFrame(pas);
    };
    rafale = requestAnimationFrame(pas);
    return () => {
      annule = true;
      cancelAnimationFrame(rafale);
      setParle(false);
      void (contexte as AudioContext | null)?.close().catch(() => undefined);
      (micPropre as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    };
  }, [defile, suivi, vitesse, mots.length, setPosition]);

  // « voix » : reconnaissance vocale, et alignement sur le texte.
  useEffect(() => {
    if (!defile || suivi !== "voix") return;
    const Reco = constructeurReconnaissance();
    if (!Reco) {
      setSuivi("rythme");
      return;
    }
    let actif = true;
    const reco = new Reco();
    reco.lang = navigator.language || "fr-FR";
    reco.continuous = true;
    reco.interimResults = true;
    reco.onresult = (e) => {
      let transcription = "";
      for (let i = Math.max(0, e.results.length - 3); i < e.results.length; i++) {
        transcription += ` ${e.results[i][0]?.transcript ?? ""}`;
      }
      const pos = Math.floor(positionRef.current);
      const suivant = alignerPosition(norms, motsEntendus(transcription), pos);
      if (suivant !== pos) setPosition(suivant);
    };
    reco.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      actif = false;
      setInfo(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Reconnaissance vocale refusée : le texte avance maintenant quand vous parlez."
          : "Reconnaissance vocale indisponible (réseau ?) : le texte avance maintenant quand vous parlez."
      );
      setSuivi("rythme");
    };
    // La reconnaissance s'arrête d'elle-même après un silence : on la relance.
    reco.onend = () => {
      if (!actif) return;
      try {
        reco.start();
      } catch {
        // déjà relancée
      }
    };
    try {
      reco.start();
    } catch {
      setSuivi("rythme");
    }
    return () => {
      actif = false;
      reco.onend = null;
      reco.abort();
    };
  }, [defile, suivi, norms, setPosition]);

  // --- Enregistrement ----------------------------------------------------------

  const nettoyerMinuteries = () => {
    minuteriesRef.current.forEach((t) => window.clearTimeout(t));
    minuteriesRef.current = [];
  };

  const commencer = useCallback(
    (f: MediaStream) => {
      if (typeof MediaRecorder === "undefined") {
        setErreurCamera("Ce navigateur ne sait pas enregistrer de vidéo.");
        setEtat("pret");
        return;
      }
      const format = choisirFormatVideo((t) => MediaRecorder.isTypeSupported(t));
      if (!format) {
        setErreurCamera("Aucun format vidéo disponible dans ce navigateur.");
        setEtat("pret");
        return;
      }
      const video = videoRef.current;
      const canevas = canevasRef.current as (HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }) | null;
      let aEnregistrer = f;
      // Recadrage au format choisi : le canevas redessine la zone centrale de
      // l'image. Sans canevas capturable, on enregistre l'image entière.
      if (video && canevas?.captureStream && video.videoWidth && video.videoHeight) {
        const r = rectangleCadrage(video.videoWidth, video.videoHeight, cadrage);
        canevas.width = r.sw;
        canevas.height = r.sh;
        const ctx = canevas.getContext("2d");
        if (ctx) {
          const dessiner = () => {
            ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh);
            dessinRef.current = requestAnimationFrame(dessiner);
          };
          dessiner();
          aEnregistrer = new MediaStream([...canevas.captureStream(30).getVideoTracks(), ...f.getAudioTracks()]);
        }
      }
      const morceaux: Blob[] = [];
      const enregistreur = new MediaRecorder(aEnregistrer, {
        mimeType: format.mimeType,
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000,
      });
      enregistreur.ondataavailable = (e) => {
        if (e.data.size) morceaux.push(e.data);
      };
      enregistreur.onstop = () => {
        if (dessinRef.current !== null) cancelAnimationFrame(dessinRef.current);
        dessinRef.current = null;
        const blob = new Blob(morceaux, { type: format.mimeType.split(";")[0] });
        setResultat({
          url: URL.createObjectURL(blob),
          blob,
          taille: blob.size,
          extension: format.extension,
          nom: nomFichierCapsule(new Date(), format.extension),
        });
      };
      enregistreur.start(1000);
      enregistreurRef.current = enregistreur;
      const debut = Date.now();
      setEcoule(0);
      const horloge = window.setInterval(() => setEcoule((Date.now() - debut) / 1000), 250);
      minuteriesRef.current.push(horloge);
      setEtat("enregistre");
      setPosition(0);
      setDefile(true);
    },
    [cadrage, setPosition]
  );

  const enregistrer = useCallback(async () => {
    const f = await activerCamera();
    if (!f) return;
    setResultat(null);
    setEtat("decompte");
    setDefile(false);
    setPosition(0);
    // 3, 2, 1 : le temps de se placer et de regarder l'objectif.
    [3, 2, 1].forEach((n, i) => {
      minuteriesRef.current.push(window.setTimeout(() => setDecompte(n), i * 1000));
    });
    minuteriesRef.current.push(window.setTimeout(() => commencer(f), 3000));
  }, [activerCamera, commencer, setPosition]);

  const arreter = useCallback(() => {
    nettoyerMinuteries();
    setDefile(false);
    const e = enregistreurRef.current;
    enregistreurRef.current = null;
    if (e && e.state !== "inactive") e.stop();
    setEtat(e ? "termine" : "pret");
  }, []);

  const refaire = useCallback(() => {
    if (resultatRef.current) URL.revokeObjectURL(resultatRef.current.url);
    setResultat(null);
    setEtat("pret");
    setPosition(0);
  }, [setPosition]);

  // Tout s'éteint à la fermeture : caméra, micro, minuteries, fichier en mémoire.
  useEffect(
    () => () => {
      nettoyerMinuteries();
      const e = enregistreurRef.current;
      if (e && e.state !== "inactive") {
        e.onstop = null;
        e.stop();
      }
      if (dessinRef.current !== null) cancelAnimationFrame(dessinRef.current);
      fluxRef.current?.getTracks().forEach((t) => t.stop());
      if (resultatRef.current) URL.revokeObjectURL(resultatRef.current.url);
    },
    []
  );

  const fermer = useCallback(() => {
    if (etat === "enregistre" && !window.confirm("L'enregistrement en cours sera perdu. Fermer le prompteur ?")) return;
    onClose();
  }, [etat, onClose]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") fermer();
      else if (e.key === " ") {
        e.preventDefault();
        if (etat !== "decompte") setDefile((d) => !d);
      } else if (e.key === "ArrowDown") setPosition(Math.min(Math.floor(positionRef.current) + 5, mots.length));
      else if (e.key === "ArrowUp") setPosition(Math.max(Math.floor(positionRef.current) - 5, 0));
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [fermer, etat, mots.length, setPosition]);

  if (typeof document === "undefined") return null;

  const ratio = CADRAGES.find((c) => c.id === cadrage)?.ratio ?? 1;
  const estime = dureeEstimee(texte, suivi === "voix" ? MOTS_PAR_MINUTE : vitesse);
  const depasse = etat === "enregistre" && ecoule > dureeCible;

  return createPortal(
    <div className={styles.voile} role="dialog" aria-modal="true" aria-label={`Prompteur — ${titre}`}>
      <header className={styles.entete}>
        <div className={styles.titre}>
          <span aria-hidden="true">🎬</span> {titre}
          <span className={styles.duree}>
            ≈ {formatDuree(estime)} · visé {formatDuree(dureeCible)}
          </span>
        </div>
        <button type="button" className={styles.fermer} onClick={fermer} aria-label="Fermer le prompteur">
          ×
        </button>
      </header>

      <div className={styles.scene}>
      <div className={styles.zone} ref={zoneRef} style={{ fontSize: taille }}>
        <div className={styles.repere} style={{ top: `${ANCRE * 100}%` }} aria-hidden="true" />
        <div className={styles.colonne} ref={colonneRef} style={{ transform: `translateY(${decalage}px)` }}>
          {paragraphes.map((para, p) => (
            <p key={p} className={styles.paragraphe}>
              {para.map(({ index, mot }) => (
                <span
                  key={index}
                  data-i={index}
                  className={[
                    styles.mot,
                    index < courant ? styles.dit : index === courant ? styles.courant : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setPosition(index)}
                >
                  {mot}{" "}
                </span>
              ))}
            </p>
          ))}
          <p className={styles.finTexte}>— fin —</p>
        </div>
      </div>

      {/* Vignette de la caméra, au format enregistré : ce qu'on voit est ce
          qui sera filmé. En miroir, comme dans une glace ; la vidéo, elle,
          est enregistrée à l'endroit. */}
      <div className={styles.vignette} style={{ aspectRatio: String(ratio) }}>
        {flux ? (
          <video ref={videoRef} className={styles.video} muted playsInline autoPlay />
        ) : (
          <button type="button" className={styles.activer} onClick={() => void activerCamera()}>
            {erreurCamera ? "Réessayer la caméra" : "Activer la caméra"}
          </button>
        )}
        {etat === "enregistre" && (
          <span className={[styles.rec, depasse ? styles.recDepasse : ""].filter(Boolean).join(" ")}>
            ● {formatDuree(ecoule)}
          </span>
        )}
        {suivi === "rythme" && defile && <span className={[styles.micro, parle ? styles.microActif : ""].join(" ")} />}
      </div>
      <canvas ref={canevasRef} className={styles.canevas} aria-hidden="true" />

      {etat === "decompte" && decompte > 0 && (
        <div className={styles.decompte} aria-live="assertive">
          {decompte}
        </div>
      )}

      {(erreurCamera || info) && (
        <p className={styles.info} role="status">
          {erreurCamera ?? info}
        </p>
      )}
      </div>

      <footer className={styles.commandes}>
        <div className={styles.groupe}>
          {etat === "enregistre" ? (
            <button type="button" className={styles.stop} onClick={arreter}>
              ■ Arrêter {fini ? "— fin du texte" : ""}
            </button>
          ) : (
            <button
              type="button"
              className={styles.record}
              onClick={() => void enregistrer()}
              disabled={etat === "decompte"}
              title="Compte à rebours, puis le texte défile et la caméra enregistre"
            >
              ● Enregistrer
            </button>
          )}
          <button
            type="button"
            className={styles.bouton}
            onClick={() => setDefile((d) => !d)}
            disabled={etat === "decompte"}
            title="Espace"
          >
            {defile ? "❚❚ Pause" : fini ? "Relire" : "▶ Répéter"}
          </button>
          <button type="button" className={styles.bouton} onClick={() => setPosition(0)} title="Revenir au début">
            ↺
          </button>
        </div>

        <div className={styles.groupe}>
          <label className={styles.libelle}>
            Suivi
            <select
              className={styles.choix}
              value={suivi}
              onChange={(e) => {
                setInfo(null);
                setSuivi(e.target.value as Suivi);
              }}
            >
              {reconnaissanceDisponible && <option value="voix">Suivre ma voix</option>}
              <option value="rythme">Au rythme de ma voix</option>
              <option value="auto">Défilement régulier</option>
            </select>
          </label>
          {suivi !== "voix" && (
            <label className={styles.libelle}>
              Vitesse
              <input
                type="range"
                min={90}
                max={220}
                step={10}
                value={vitesse}
                onChange={(e) => setVitesse(parseInt(e.target.value, 10))}
                aria-valuetext={`${vitesse} mots par minute`}
              />
            </label>
          )}
          <span className={styles.taille}>
            <button type="button" className={styles.bouton} onClick={() => setTaille((t) => Math.max(20, t - 4))} aria-label="Texte plus petit">
              A−
            </button>
            <button type="button" className={styles.bouton} onClick={() => setTaille((t) => Math.min(72, t + 4))} aria-label="Texte plus grand">
              A+
            </button>
          </span>
          <label className={styles.libelle}>
            Format
            <select
              className={styles.choix}
              value={cadrage}
              onChange={(e) => setCadrage(e.target.value as Cadrage)}
              disabled={etat === "enregistre" || etat === "decompte"}
            >
              {CADRAGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>
      </footer>

      {resultat && (
        <div className={styles.resultat} role="dialog" aria-label="Votre capsule">
          <div className={styles.carte}>
            <h2 className={styles.carteTitre}>Votre capsule est prête</h2>
            <video className={styles.lecture} src={resultat.url} controls playsInline />
            <div className={styles.actions}>
              <a className={styles.record} href={resultat.url} download={resultat.nom}>
                Télécharger ({resultat.extension.toUpperCase()}, {(resultat.taille / 1_048_576).toFixed(1).replace(".", ",")} Mo)
              </a>
              {/* Sur iPhone, un fichier « téléchargé » part dans Fichiers : la
                  feuille de partage, elle, propose « Enregistrer la vidéo »
                  (Photos) et LinkedIn directement. */}
              {partageable(resultat) && (
                <button type="button" className={styles.bouton} onClick={() => void partager(resultat)}>
                  Enregistrer / partager
                </button>
              )}
              <button type="button" className={styles.bouton} onClick={refaire}>
                Refaire une prise
              </button>
            </div>
            <p className={styles.note}>
              La vidéo n&apos;est enregistrée que sur cet appareil : téléchargez-la avant de fermer le
              prompteur, puis publiez-la depuis LinkedIn.
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
