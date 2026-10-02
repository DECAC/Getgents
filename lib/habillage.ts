/**
 * Habillage d'une capsule vidéo (sous-titres, effets, musique). Module PUR :
 * le rendu (canevas, Web Audio) vit dans components/habillage.
 *
 * Les sous-titres ne passent par AUCUN service de transcription : le texte
 * est connu (c'est le script du prompteur), il ne reste qu'à le CALER sur la
 * voix. On repère les moments de parole dans la piste son (`segmentsParole`),
 * puis on y répartit les mots selon leur longueur parlée (`alignerMots`).
 * Pour un texte lu, l'écart reste de l'ordre de la syllabe ; un réglage de
 * décalage et l'édition de chaque sous-titre rattrapent le reste.
 */

import { normaliserMot } from "./prompteur";

// --- Réglages et styles ------------------------------------------------------

export type StyleSousTitres = "karaoke" | "motAMot" | "classique" | "aucun";
export type PositionSousTitres = "haut" | "milieu" | "bas";
export type Etalonnage = "naturel" | "chaud" | "contraste" | "nb";
export type StyleMusique = "aucune" | "inspirant" | "energique" | "lofi" | "corporate" | "importee";

export interface ReglagesHabillage {
  sousTitres: StyleSousTitres;
  position: PositionSousTitres;
  /** Identifiant dans `ACCENTS_VIDEO` : jamais de couleur libre. */
  accent: string;
  grande: boolean;
  zooms: boolean;
  etalonnage: Etalonnage;
  progression: boolean;
  bandeauTitre: boolean;
  cartonFin: boolean;
  musique: StyleMusique;
  /** 0 à 1 : volume de la musique quand personne ne parle. */
  volumeMusique: number;
  /** La musique se baisse sous la voix. */
  attenuation: boolean;
}

export const ACCENTS_VIDEO: { id: string; libelle: string; couleur: string }[] = [
  { id: "jaune", libelle: "Jaune", couleur: "#FFD23F" },
  { id: "corail", libelle: "Corail", couleur: "#FF6B5B" },
  { id: "vert", libelle: "Vert", couleur: "#5BE38C" },
  { id: "bleu", libelle: "Bleu", couleur: "#5BB8FF" },
  { id: "blanc", libelle: "Blanc", couleur: "#FFFFFF" },
];

export function couleurAccent(id: string): string {
  return (ACCENTS_VIDEO.find((a) => a.id === id) ?? ACCENTS_VIDEO[0]).couleur;
}

export const LIBELLES_MUSIQUE: Record<StyleMusique, string> = {
  aucune: "Sans musique",
  inspirant: "Inspirant (nappes douces)",
  energique: "Énergique (rythmé)",
  lofi: "Lo-fi (posé)",
  corporate: "Corporate (léger)",
  importee: "Ma musique (fichier)",
};

export const LIBELLES_ETALONNAGE: Record<Etalonnage, string> = {
  naturel: "Naturel",
  chaud: "Chaud",
  contraste: "Contrasté",
  nb: "Noir & blanc",
};

export const LIBELLES_SOUS_TITRES: Record<StyleSousTitres, string> = {
  karaoke: "Karaoké (mot surligné)",
  motAMot: "Mot à mot (en grand)",
  classique: "Classique (bandeau)",
  aucun: "Sans sous-titres",
};

/** Un style = un choix visuel ET audio, retouchable ensuite point par point. */
export const STYLES_HABILLAGE: { id: string; libelle: string; description: string; reglages: ReglagesHabillage }[] = [
  {
    id: "percutant",
    libelle: "Percutant",
    description: "Mots surlignés, zooms au rythme des phrases, musique rythmée.",
    reglages: {
      sousTitres: "karaoke",
      position: "milieu",
      accent: "jaune",
      grande: true,
      zooms: true,
      etalonnage: "contraste",
      progression: true,
      bandeauTitre: false,
      cartonFin: true,
      musique: "energique",
      volumeMusique: 0.5,
      attenuation: true,
    },
  },
  {
    id: "pro",
    libelle: "Pro LinkedIn",
    description: "Titre en haut, sous-titres en bandeau, musique légère.",
    reglages: {
      sousTitres: "classique",
      position: "bas",
      accent: "bleu",
      grande: false,
      zooms: false,
      etalonnage: "naturel",
      progression: true,
      bandeauTitre: true,
      cartonFin: true,
      musique: "corporate",
      volumeMusique: 0.4,
      attenuation: true,
    },
  },
  {
    id: "inspirant",
    libelle: "Inspirant",
    description: "Image chaude, mots qui s'allument, nappes douces.",
    reglages: {
      sousTitres: "karaoke",
      position: "bas",
      accent: "corail",
      grande: false,
      zooms: false,
      etalonnage: "chaud",
      progression: false,
      bandeauTitre: false,
      cartonFin: true,
      musique: "inspirant",
      volumeMusique: 0.45,
      attenuation: true,
    },
  },
  {
    id: "dynamique",
    libelle: "Mot à mot",
    description: "Un mot à la fois, en grand, au centre : le format des vidéos courtes.",
    reglages: {
      sousTitres: "motAMot",
      position: "milieu",
      accent: "vert",
      grande: true,
      zooms: true,
      etalonnage: "contraste",
      progression: true,
      bandeauTitre: false,
      cartonFin: false,
      musique: "lofi",
      volumeMusique: 0.45,
      attenuation: true,
    },
  },
  {
    id: "sobre",
    libelle: "Sobre",
    description: "Sous-titres seuls, ni effet ni musique : la voix d'abord.",
    reglages: {
      sousTitres: "classique",
      position: "bas",
      accent: "blanc",
      grande: false,
      zooms: false,
      etalonnage: "naturel",
      progression: false,
      bandeauTitre: false,
      cartonFin: false,
      musique: "aucune",
      volumeMusique: 0.4,
      attenuation: true,
    },
  },
];

/** Réglages relus (navigateur) : tout champ inconnu ou abîmé retombe sur le style. */
export function reglagesValides(lu: unknown, base: ReglagesHabillage = STYLES_HABILLAGE[0].reglages): ReglagesHabillage {
  const o = (lu && typeof lu === "object" ? lu : {}) as Record<string, unknown>;
  const dans = <T extends string>(v: unknown, permis: readonly T[], defaut: T): T =>
    permis.includes(v as T) ? (v as T) : defaut;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    sousTitres: dans(o.sousTitres, ["karaoke", "motAMot", "classique", "aucun"] as const, base.sousTitres),
    position: dans(o.position, ["haut", "milieu", "bas"] as const, base.position),
    accent: dans(o.accent, ACCENTS_VIDEO.map((a) => a.id), base.accent),
    grande: bool(o.grande, base.grande),
    zooms: bool(o.zooms, base.zooms),
    etalonnage: dans(o.etalonnage, ["naturel", "chaud", "contraste", "nb"] as const, base.etalonnage),
    progression: bool(o.progression, base.progression),
    bandeauTitre: bool(o.bandeauTitre, base.bandeauTitre),
    cartonFin: bool(o.cartonFin, base.cartonFin),
    // Un fichier importé ne survit pas au rechargement : on retombe sur le style.
    musique: dans(o.musique, ["aucune", "inspirant", "energique", "lofi", "corporate"] as const, base.musique),
    volumeMusique:
      typeof o.volumeMusique === "number" && o.volumeMusique >= 0 && o.volumeMusique <= 1 ? o.volumeMusique : base.volumeMusique,
    attenuation: bool(o.attenuation, base.attenuation),
  };
}

// --- Parole dans la piste son -------------------------------------------------

export interface Segment {
  debut: number;
  fin: number;
}

/** Durée d'une trame d'analyse du niveau sonore. */
export const PAS_ANALYSE = 0.02;

/** Valeur efficace par trame de `pas` secondes. */
export function niveauxParTrame(echantillons: ArrayLike<number>, frequence: number, pas = PAS_ANALYSE): number[] {
  const taille = Math.max(1, Math.round(frequence * pas));
  const niveaux: number[] = [];
  for (let debut = 0; debut < echantillons.length; debut += taille) {
    const fin = Math.min(echantillons.length, debut + taille);
    let somme = 0;
    for (let i = debut; i < fin; i++) somme += echantillons[i] * echantillons[i];
    niveaux.push(Math.sqrt(somme / (fin - debut)));
  }
  return niveaux;
}

function quantile(valeurs: number[], q: number): number {
  if (!valeurs.length) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.min(tri.length - 1, Math.max(0, Math.floor(q * (tri.length - 1))))];
}

/**
 * Moments de parole. Le seuil s'adapte à la prise : entre le bruit de fond
 * (10e centile) et la voix (95e), au quart — une pièce bruyante comme un
 * micro-cravate très proche donnent le bon découpage. Les silences de moins
 * de 250 ms (entre deux mots) ne coupent pas ; les éclats de moins de 120 ms
 * (un clic, un souffle) ne comptent pas.
 */
export function segmentsParole(niveaux: number[], pas = PAS_ANALYSE): Segment[] {
  if (!niveaux.length) return [];
  const fond = quantile(niveaux, 0.1);
  const voix = quantile(niveaux, 0.95);
  if (voix < 0.003 || voix < fond * 2) return [];
  const seuil = Math.max(0.002, fond + (voix - fond) * 0.25);
  const bruts: Segment[] = [];
  let debut = -1;
  niveaux.forEach((n, i) => {
    if (n >= seuil && debut < 0) debut = i;
    if (n < seuil && debut >= 0) {
      bruts.push({ debut: debut * pas, fin: i * pas });
      debut = -1;
    }
  });
  if (debut >= 0) bruts.push({ debut: debut * pas, fin: niveaux.length * pas });
  const fusionnes: Segment[] = [];
  for (const s of bruts) {
    const dernier = fusionnes[fusionnes.length - 1];
    if (dernier && s.debut - dernier.fin < 0.25) dernier.fin = s.fin;
    else fusionnes.push({ ...s });
  }
  return fusionnes.filter((s) => s.fin - s.debut >= 0.12);
}

// --- Calage des mots ----------------------------------------------------------

export interface MotTemps {
  mot: string;
  debut: number;
  fin: number;
}

/** Longueur parlée d'un mot, en syllabes à peu près (groupes de voyelles). */
export function poidsMot(mot: string): number {
  const n = normaliserMot(mot);
  if (!n) return 0.3;
  if (/^\d+$/.test(n)) return 0.4 + n.length; // « 2026 » se dit en plusieurs syllabes
  const syllabes = (n.match(/[aeiouy]+/g) ?? []).length;
  // Le « e » final ne se prononce pas (« trouve », « confiance »).
  const muet = /[^aeiouy]e$|[^aeiouy]es$/.test(n) && syllabes > 1 ? 1 : 0;
  return 0.4 + Math.max(1, syllabes - muet);
}

/**
 * Cale chaque mot dans le temps : la durée de PAROLE (silences exclus) est
 * répartie entre les mots selon leur poids, puis replacée sur la vraie
 * chronologie. Sans parole détectée, le texte s'étale sur toute la vidéo.
 */
export function alignerMots(mots: string[], segments: Segment[], duree: number): MotTemps[] {
  if (!mots.length) return [];
  const zones = segments.length ? segments : [{ debut: Math.min(0.3, duree / 10), fin: Math.max(0.1, duree - 0.3) }];
  const totalParole = zones.reduce((s, z) => s + (z.fin - z.debut), 0);
  const poids = mots.map(poidsMot);
  const totalPoids = poids.reduce((a, b) => a + b, 0);

  // Temps de parole cumulé → temps réel.
  const versReel = (tp: number): number => {
    let reste = tp;
    for (const z of zones) {
      const l = z.fin - z.debut;
      if (reste <= l + 1e-9) return z.debut + reste;
      reste -= l;
    }
    return zones[zones.length - 1].fin;
  };
  // Un mot ne s'étale pas sur un silence : il finit avec son segment.
  const finDansZone = (debut: number, fin: number): number => {
    const z = zones.find((s) => debut >= s.debut - 1e-9 && debut < s.fin);
    return z ? Math.min(fin, z.fin) : fin;
  };

  let cumul = 0;
  return mots.map((mot, i) => {
    const debut = versReel((cumul / totalPoids) * totalParole + 1e-6);
    cumul += poids[i];
    const fin = finDansZone(debut, versReel((cumul / totalPoids) * totalParole));
    return { mot, debut: Math.max(0, debut - 1e-6), fin: Math.max(fin, debut + 0.05) };
  });
}

// --- Sous-titres ----------------------------------------------------------------

export interface SousTitre {
  debut: number;
  fin: number;
  mots: MotTemps[];
}

const FIN_PHRASE = /[.!?…]["»”)]*$/;
const PAUSE_PONCTUATION = /[,;:]["»”)]*$/;

/**
 * Découpe en sous-titres courts : on lit un sous-titre d'un coup d'œil.
 * Coupure à la fin d'une phrase, à une virgule (si le bloc a déjà deux
 * mots), à `maxMots` mots ou `maxCar` caractères, ou sur un vrai silence.
 */
export function decouperSousTitres(mots: MotTemps[], maxMots = 5, maxCar = 30): SousTitre[] {
  const blocs: SousTitre[] = [];
  let courant: MotTemps[] = [];
  const clore = () => {
    if (!courant.length) return;
    blocs.push({ debut: courant[0].debut, fin: courant[courant.length - 1].fin, mots: courant });
    courant = [];
  };
  mots.forEach((m, i) => {
    const longueur = courant.reduce((s, c) => s + c.mot.length + 1, 0) + m.mot.length;
    if (courant.length && (courant.length >= maxMots || longueur > maxCar)) clore();
    courant.push(m);
    const suivant = mots[i + 1];
    if (
      FIN_PHRASE.test(m.mot) ||
      (PAUSE_PONCTUATION.test(m.mot) && courant.length >= 2) ||
      (suivant && suivant.debut - m.fin > 0.45)
    ) {
      clore();
    }
  });
  clore();
  // Un sous-titre reste un instant après son dernier mot, sans chevaucher le suivant.
  return blocs.map((b, i) => ({
    ...b,
    fin: Math.min(b.fin + 0.3, blocs[i + 1]?.debut ?? Infinity),
  }));
}

/** Le sous-titre affiché à l'instant `t`, s'il y en a un. */
export function sousTitreA(blocs: SousTitre[], t: number): SousTitre | null {
  return blocs.find((b) => t >= b.debut && t < b.fin) ?? null;
}

/** Mot tel qu'affiché : sans ponctuation de fin, sauf ? et ! qui portent le ton. */
export function motAffiche(mot: string): string {
  return mot.replace(/[.,;:…]+(["»”)]*)$/, "$1").replace(/\s+$/, "");
}

/**
 * Les mots d'un texte, ponctuation « à la française » rattachée : dans
 * « demain ? » ou « Résultat : », l'espace avant le signe en faisait un mot
 * à part — un sous-titre « ? » tout seul. Une espace insécable les lie.
 */
export function motsDuTexte(texte: string): string[] {
  const mots: string[] = [];
  for (const brut of texte.split(/\s+/).filter(Boolean)) {
    if (/^[?!:;»”…]+$/.test(brut) && mots.length) mots[mots.length - 1] += `\u00a0${brut}`;
    else if (mots.length && /^[«“]$/.test(mots[mots.length - 1])) mots[mots.length - 1] += `\u00a0${brut}`;
    else mots.push(brut);
  }
  return mots;
}

/**
 * Remplace le texte d'un sous-titre (mot mal dit, phrase improvisée) : les
 * nouveaux mots se partagent le temps du bloc, au poids, comme au calage.
 */
export function remplacerTexte(bloc: SousTitre, texte: string): SousTitre {
  const mots = motsDuTexte(texte);
  if (!mots.length) return { ...bloc, mots: [] };
  const debut = bloc.mots[0]?.debut ?? bloc.debut;
  const fin = bloc.mots[bloc.mots.length - 1]?.fin ?? bloc.fin;
  return { ...bloc, mots: alignerMots(mots, [{ debut, fin }], fin) };
}

/**
 * Répartit des mots sur des lignes d'une largeur donnée (`mesure` vient du
 * canevas). Au-delà de `maxLignes`, la dernière ligne garde le reste : mieux
 * vaut déborder que perdre un mot.
 */
export function repartirLignes(mots: string[], mesure: (texte: string) => number, largeurMax: number, maxLignes = 2): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  for (const m of mots) {
    const essai = [...ligne, m].join(" ");
    if (ligne.length && mesure(essai) > largeurMax && lignes.length < maxLignes - 1) {
      lignes.push(ligne);
      ligne = [m];
    } else {
      ligne.push(m);
    }
  }
  if (ligne.length) lignes.push(ligne);
  return lignes;
}

// --- Effets -----------------------------------------------------------------------

/** Début de chaque phrase (pour les zooms) : après un mot qui finit une phrase. */
export function debutsDePhrases(mots: MotTemps[]): number[] {
  const debuts: number[] = [];
  mots.forEach((m, i) => {
    if (i === 0 || FIN_PHRASE.test(mots[i - 1].mot)) debuts.push(m.debut);
  });
  return debuts;
}

export const ZOOM_SERRE = 1.12;
const DUREE_ZOOM = 0.22;

/**
 * Zoom « coupé » à chaque phrase, une sur deux plus serrée : la relance de
 * rythme des vidéos courtes. Bascule rapide (220 ms), pas un lent travelling.
 */
export function facteurZoom(t: number, debuts: number[]): number {
  let k = -1;
  for (let i = 0; i < debuts.length && debuts[i] <= t; i++) k = i;
  if (k < 0) return 1;
  const cible = k % 2 === 1 ? ZOOM_SERRE : 1;
  const precedent = k % 2 === 1 ? 1 : k === 0 ? 1 : ZOOM_SERRE;
  const avance = Math.min(1, (t - debuts[k]) / DUREE_ZOOM);
  const doux = 1 - Math.pow(1 - avance, 3);
  return precedent + (cible - precedent) * doux;
}

/** Filtre du canevas par étalonnage (`ctx.filter`). */
export const FILTRES_ETALONNAGE: Record<Etalonnage, string> = {
  naturel: "none",
  chaud: "sepia(0.18) saturate(1.15) contrast(1.04)",
  contraste: "contrast(1.16) saturate(1.2)",
  nb: "grayscale(1) contrast(1.15)",
};

/** Durée du carton de fin, ajouté APRÈS la vidéo. */
export const DUREE_CARTON = 2.5;

// --- Musique sous la voix -----------------------------------------------------------

export interface PointVolume {
  t: number;
  g: number;
}

/** Part du volume gardée sous la voix : la musique accompagne, la voix porte. */
export const ATTENUATION_SOUS_VOIX = 0.3;

/**
 * Courbe de volume de la musique : fondu d'entrée, baisse sous la voix
 * (150 ms avant qu'elle ne parte, remontée 400 ms après), fondu de sortie.
 * Les silences de moins de 800 ms ne font pas remonter : la musique
 * « pomperait » à chaque respiration.
 */
export function enveloppeMusique(
  segments: Segment[],
  duree: number,
  volume: number,
  attenuation: boolean
): PointVolume[] {
  const bas = volume * ATTENUATION_SOUS_VOIX;
  const points: PointVolume[] = [{ t: 0, g: 0 }];
  const entree = Math.min(1, duree / 4);
  const zones: Segment[] = [];
  if (attenuation) {
    for (const s of segments) {
      const d = zones[zones.length - 1];
      if (d && s.debut - d.fin < 0.8) d.fin = s.fin;
      else zones.push({ ...s });
    }
  }
  const niveau = (t: number) => (zones.some((z) => t >= z.debut - 0.15 && t <= z.fin + 0.4) ? bas : volume);
  points.push({ t: entree, g: niveau(entree) });
  for (const z of zones) {
    const avant = Math.max(entree, z.debut - 0.15);
    const apres = z.fin + 0.4;
    if (avant > entree) points.push({ t: avant, g: volume }, { t: Math.max(avant, z.debut), g: bas });
    if (apres < duree - 1.5) points.push({ t: z.fin, g: bas }, { t: apres, g: volume });
  }
  const sortie = Math.max(entree, duree - 1.5);
  points.push({ t: sortie, g: niveau(sortie) }, { t: duree, g: 0 });
  // Dans l'ordre, sans doublon de temps (la dernière valeur l'emporte).
  const tri = points.sort((a, b) => a.t - b.t);
  return tri.filter((p, i) => i === tri.length - 1 || tri[i + 1].t > p.t + 1e-6);
}

export function nomFichierHabille(nom: string, extension: string): string {
  return nom.replace(/\.[a-z0-9]+$/i, "") + `-habillee.${extension}`;
}
