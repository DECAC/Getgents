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
  nomDefinition,
  debitVideo,
  estIOS,
  FACTEUR_ARTICULATION,
  MAINTIEN_PAROLE_MS,
  VITESSE_RYTHME_DEFAUT,
  vitesseCorrigee,
  rectangleCadrage,
  type Cadrage,
} from "@/lib/prompteur";
import { TestSon } from "./TestSon";
import { Habillage } from "@/components/habillage/Habillage";
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
  largeur: number;
  hauteur: number;
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

async function partager(r: Resultat): Promise<boolean> {
  try {
    await navigator.share({ files: [fichierDe(r)], title: r.nom });
    return true;
  } catch {
    // Partage annulé par l'utilisateur : rien à signaler.
    return false;
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
  const [vitesse, setVitesse] = useState(VITESSE_RYTHME_DEFAUT);
  // Réglages repliés d'office : l'écran est au texte.
  const [reglages, setReglages] = useState(false);
  // La vignette se réduit en pastille pendant la lecture ; on la touche pour
  // la rouvrir. Déployée, elle couvrait les lignes à lire.
  const [vignetteOuverte, setVignetteOuverte] = useState(false);
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
  const [habiller, setHabiller] = useState(false);
  // La prise a-t-elle quitté le navigateur (téléchargée ou partagée) ? Sinon,
  // fermer la perd : on demande confirmation.
  const [gardee, setGardee] = useState(false);

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

  // Caméra et micro choisis dans les réglages ; absents, ceux du système.
  const choixRef = useRef<{ camera?: string; micro?: string }>({});

  const activerCamera = useCallback(async (forcer = false): Promise<MediaStream | null> => {
    if (fluxRef.current && !forcer) return fluxRef.current;
    const { camera: cameraId, micro: microId } = choixRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreurCamera("Ce navigateur ne donne pas accès à la caméra.");
      return null;
    }
    try {
      const f = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          // Micro choisi dans les réglages (micro-cravate…) ; sinon, celui
          // que le système a retenu.
          ...(microId ? { deviceId: { exact: microId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Une webcam de PC peut ouvrir en 640×480 malgré l'« idéal » demandé :
      // on la pousse vers sa meilleure définition (1080p au plus). Pas sur
      // iPhone, où l'idéal est tenu et où les dimensions annoncées suivent
      // l'orientation du capteur, pas celle de l'écran.
      const pisteVideo = f.getVideoTracks()[0];
      if (pisteVideo && !estIOS(navigator.userAgent)) {
        try {
          const cap = pisteVideo.getCapabilities?.();
          const reglage = pisteVideo.getSettings();
          const largeurMax = Math.min(cap?.width?.max ?? 0, 1920);
          const hauteurMax = Math.min(cap?.height?.max ?? 0, 1080);
          if (largeurMax && hauteurMax && (reglage.width ?? 0) < largeurMax) {
            await pisteVideo.applyConstraints({
              width: { ideal: largeurMax },
              height: { ideal: hauteurMax },
              frameRate: { ideal: 30 },
            });
          }
        } catch {
          // La caméra garde sa définition : l'enregistrement reste possible.
        }
      }
      // Changement de micro : l'ancien flux s'éteint, le nouveau le remplace.
      if (fluxRef.current && fluxRef.current !== f) fluxRef.current.getTracks().forEach((t) => t.stop());
      setErreurCamera(null);
      setFlux(f);
      return f;
    } catch (e) {
      const nom = (e as Error).name;
      setErreurCamera(
        nom === "NotAllowedError"
          ? estIOS(navigator.userAgent)
            ? "Caméra et micro refusés. Sur iPhone : app Réglages › Chrome (ou Safari) › Caméra et Micro, puis « Réessayer la caméra ». Le texte, lui, défile quand même."
            : "Caméra et micro refusés. Autorisez-les dans les réglages du site pour enregistrer — le texte, lui, défile quand même."
          : nom === "NotFoundError" || nom === "OverconstrainedError"
            ? "Caméra ou micro introuvable : choisissez-en un autre dans les réglages ⚙."
            : nom === "NotReadableError"
              ? "La caméra ou le micro est déjà utilisé par une autre application (visio, appareil photo…). Fermez-la, puis « Réessayer la caméra »."
              : "La caméra n'a pas pu démarrer."
      );
      return null;
    }
  }, []);

  // Les micros ne portent un NOM qu'une fois l'accès accordé : la liste se lit
  // après l'ouverture du flux, et se relit quand on branche un micro.
  const [micros, setMicros] = useState<{ id: string; nom: string }[]>([]);
  const [cameras, setCameras] = useState<{ id: string; nom: string }[]>([]);
  const microActif = flux?.getAudioTracks()[0];
  const cameraActive = flux?.getVideoTracks()[0];
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const lire = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((appareils) => {
          const liste = (genre: MediaDeviceKind, prefixe: string) =>
            appareils
              .filter((a) => a.kind === genre && a.deviceId)
              .map((a, i) => ({ id: a.deviceId, nom: a.label || `${prefixe} ${i + 1}` }));
          setMicros(liste("audioinput", "Micro"));
          setCameras(liste("videoinput", "Caméra"));
        })
        .catch(() => undefined);
    void lire();
    navigator.mediaDevices.addEventListener?.("devicechange", lire);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", lire);
  }, [flux]);

  // Demandée à l'ouverture : on vient pour tourner.
  useEffect(() => {
    void activerCamera();
  }, [activerCamera]);

  // Définition RÉELLE de l'image, lue sur la vidéo (et non sur les réglages de
  // la piste, dont l'orientation diffère sur téléphone) : affichée dans ⚙.
  const [image, setImage] = useState<{ l: number; h: number } | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const lire = () => (v.videoWidth ? setImage({ l: v.videoWidth, h: v.videoHeight }) : undefined);
    lire();
    v.addEventListener("loadedmetadata", lire);
    v.addEventListener("resize", lire);
    return () => {
      v.removeEventListener("loadedmetadata", lire);
      v.removeEventListener("resize", lire);
    };
  }, [flux]);

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

  // Une information s'efface seule : elle recouvrait les lignes à lire.
  useEffect(() => {
    if (!info) return;
    const t = window.setTimeout(() => setInfo(null), 7000);
    return () => window.clearTimeout(t);
  }, [info]);
  const [erreurMasquee, setErreurMasquee] = useState(false);
  useEffect(() => setErreurMasquee(false), [erreurCamera]);

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
        if (niveau > Math.max(0.015, plancher * 3)) finParole = maintenant + MAINTIEN_PAROLE_MS;
        avance = maintenant < finParole;
        setParle(avance);
      }
      // En parole, on articule plus vite que la moyenne pauses comprises.
      const debit = suivi === "rythme" ? vitesse * FACTEUR_ARTICULATION : vitesse;
      if (avance) setPosition(Math.min(positionRef.current + (dt * debit) / 60000, mots.length));
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
          ? "Reconnaissance vocale indisponible sur cet appareil : le texte avance quand vous parlez."
          : "Reconnaissance vocale injoignable (réseau ?) : le texte avance quand vous parlez."
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
      let dims = { l: video?.videoWidth ?? 0, h: video?.videoHeight ?? 0 };
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
          dims = { l: r.sw, h: r.sh };
          aEnregistrer = new MediaStream([...canevas.captureStream(30).getVideoTracks(), ...f.getAudioTracks()]);
        }
      }
      const morceaux: Blob[] = [];
      const enregistreur = new MediaRecorder(aEnregistrer, {
        mimeType: format.mimeType,
        videoBitsPerSecond: debitVideo(dims.l, dims.h),
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
          largeur: dims.l,
          hauteur: dims.h,
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
    setGardee(false);
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
    if (
      resultat &&
      !gardee &&
      !window.confirm("Cette capsule n'a été ni téléchargée ni partagée : elle sera perdue. Fermer quand même ?")
    )
      return;
    onClose();
  }, [etat, onClose, resultat, gardee]);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      // L'atelier d'habillage ouvert par-dessus a ses champs et ses touches :
      // Échap y fermerait le prompteur, et la prise avec.
      if (habiller) return;
      if (
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "Escape") fermer();
      else if (e.key === " ") {
        e.preventDefault();
        if (etat !== "decompte") setDefile((d) => !d);
      } else if (e.key === "ArrowDown") setPosition(Math.min(Math.floor(positionRef.current) + 5, mots.length));
      else if (e.key === "ArrowUp") setPosition(Math.max(Math.floor(positionRef.current) - 5, 0));
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [fermer, etat, mots.length, setPosition, habiller]);

  if (typeof document === "undefined") return null;

  const ratio = CADRAGES.find((c) => c.id === cadrage)?.ratio ?? 1;
  const estime = dureeEstimee(texte, suivi === "voix" ? MOTS_PAR_MINUTE : vitesse);
  const depasse = etat === "enregistre" && ecoule > dureeCible;
  const reduite = !!flux && (defile || etat === "enregistre") && !vignetteOuverte;

  return createPortal(
    <div className={styles.voile} role="dialog" aria-modal="true" aria-label={`Prompteur — ${titre}`}>
      <header className={styles.entete}>
        <div className={styles.titre}>
          <span aria-hidden="true">🎬</span>
          <span className={styles.titreTexte}>{titre}</span>
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
                  onClick={() => {
                    // En pleine lecture, l'écart entre le mot touché et le mot
                    // affiché dit si le texte va trop vite ou trop lentement.
                    if (defile && suivi !== "voix") setVitesse((v) => vitesseCorrigee(v, courant, index));
                    setPosition(index);
                  }}
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
      <div
        className={[styles.vignette, reduite ? styles.reduite : ""].filter(Boolean).join(" ")}
        style={{ aspectRatio: String(ratio) }}
        onClick={flux ? () => setVignetteOuverte((o) => !o) : undefined}
        title={flux ? (reduite ? "Afficher la caméra" : "Réduire la caméra") : undefined}
      >
        {flux ? (
          <video ref={videoRef} className={styles.video} muted playsInline autoPlay />
        ) : (
          <button type="button" className={styles.activer} onClick={() => void activerCamera()}>
            {erreurCamera ? "Réessayer la caméra" : "Activer la caméra"}
          </button>
        )}
        {etat === "enregistre" && !reduite && (
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

      {((erreurCamera && !erreurMasquee) || info) && (
        <p
          className={styles.info}
          role="status"
          onClick={() => (erreurCamera ? setErreurMasquee(true) : setInfo(null))}
          title="Toucher pour masquer"
        >
          {erreurCamera && !erreurMasquee ? erreurCamera : info}
        </p>
      )}
      </div>

      <footer className={styles.commandes}>
        <div className={styles.groupe}>
          {etat === "enregistre" ? (
            <button type="button" className={[styles.stop, depasse ? styles.stopDepasse : ""].filter(Boolean).join(" ")} onClick={arreter}>
              ■ {formatDuree(ecoule)} {fini ? "— fin" : ""}
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
          <button
            type="button"
            className={[styles.bouton, reglages ? styles.boutonActif : ""].filter(Boolean).join(" ")}
            onClick={() => setReglages((r) => !r)}
            aria-expanded={reglages}
            aria-label="Réglages"
            title="Suivi, vitesse, taille du texte, format"
          >
            ⚙
          </button>
        </div>

        {reglages && (
        <div className={styles.groupe}>
          <span className={styles.duree}>
            ≈ {formatDuree(estime)} · visé {formatDuree(dureeCible)}
          </span>
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
          {/* Toujours présents : ils ne dépendaient que d'une caméra DÉMARRÉE,
              et disparaissaient justement quand il fallait en changer. */}
          {(
            [
              ["camera", "Caméra", cameras, cameraActive],
              ["micro", "Micro", micros, microActif],
            ] as const
          ).map(([genre, libelle, liste, piste]) => (
            <label key={genre} className={styles.libelle}>
              {libelle}
              {liste.length ? (
                <select
                  className={[styles.choix, styles.appareil].join(" ")}
                  value={choixRef.current[genre] ?? piste?.getSettings().deviceId ?? ""}
                  onChange={(e) => {
                    choixRef.current = { ...choixRef.current, [genre]: e.target.value };
                    void activerCamera(true);
                  }}
                  disabled={etat === "enregistre" || etat === "decompte"}
                >
                  {!piste && !choixRef.current[genre] && <option value="">—</option>}
                  {liste.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.microNom}>{piste?.label || "aucun détecté"}</span>
              )}
            </label>
          ))}
          {image && (
            <span className={styles.duree}>
              {(() => {
                const r = rectangleCadrage(image.l, image.h, cadrage);
                return `Image ${image.l}×${image.h} → capsule ${r.sw}×${r.sh} (${nomDefinition(r.sw, r.sh)})`;
              })()}
            </span>
          )}
          <TestSon flux={flux} desactive={etat === "enregistre" || etat === "decompte"} />
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
        )}
      </footer>

      {resultat && (
        <div className={styles.resultat} role="dialog" aria-label="Votre capsule">
          <div className={styles.carte}>
            {/* La carte couvre tout l'écran, en-tête compris : sans sa propre
                sortie, on ne pouvait plus quitter le prompteur (vécu sur iPhone). */}
            <div className={styles.carteEntete}>
              <h2 className={styles.carteTitre}>Votre capsule est prête</h2>
              <button type="button" className={styles.fermer} onClick={fermer} aria-label="Fermer le prompteur">
                ×
              </button>
            </div>
            <video className={styles.lecture} src={resultat.url} controls playsInline />
            <div className={styles.actions}>
              <a className={styles.record} href={resultat.url} download={resultat.nom} onClick={() => setGardee(true)}>
                Télécharger ({resultat.extension.toUpperCase()}
                {resultat.largeur ? `, ${resultat.largeur}×${resultat.hauteur}` : ""},{" "}
                {(resultat.taille / 1_048_576).toFixed(1).replace(".", ",")} Mo)
              </a>
              {/* Sur iPhone, un fichier « téléchargé » part dans Fichiers : la
                  feuille de partage, elle, propose « Enregistrer la vidéo »
                  (Photos) et LinkedIn directement. */}
              {partageable(resultat) && (
                <button type="button" className={styles.bouton} onClick={() => void partager(resultat).then((ok) => ok && setGardee(true))}>
                  Enregistrer / partager
                </button>
              )}
              {/* Sous-titres, effets, musique : un atelier à part, sur cette prise. */}
              <button type="button" className={styles.record} onClick={() => setHabiller(true)}>
                ✨ Habiller la vidéo
              </button>
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
      {resultat && habiller && (
        <Habillage
          url={resultat.url}
          video={resultat.blob}
          nom={resultat.nom}
          texte={texte}
          titre={titre}
          onClose={() => setHabiller(false)}
        />
      )}
    </div>,
    document.body
  );
}
