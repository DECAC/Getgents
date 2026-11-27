/**
 * Calendrier et réglages du film du Publiciste (lot 1). Module PUR : le
 * dessin et l'encodage vivent dans components/publiciste/, ce qui se calcule
 * — où commence chaque scène, quand parle la voix, quand la musique baisse —
 * vit ici et se teste sans navigateur.
 *
 * Choix mesurés à l'essai du 27/11 (mockups/recit/rendu-essai/) : 30 images
 * par seconde, H.264 High, son AAC ; ~5 Mb/s suffisent en 1080×1920 (8 Mb/s
 * donnaient 70 Mo pour 72 s, sans gain visible).
 */
import type { SceneFilm } from "@/lib/publiciste";

export const FPS = 30;
export const FORMAT_VERTICAL = { largeur: 1080, hauteur: 1920 } as const;
export const DEBIT_VIDEO = 5_000_000;
export const DEBIT_AUDIO = 160_000;
export const TAUX_AUDIO = 48_000;
/** La voix entre un peu après le début de la scène, et laisse respirer avant la suivante. */
export const AVANCE_VOIX = 0.4;
export const MARGE_APRES_VOIX = 0.5;
/**
 * Gain de la voix : Mistral rend des voix vers −25 LUFS, crêtes vers −8 dBFS.
 * +5 dB (×1,8) la remettent au niveau des voix du casting (−18 à −19 LUFS)
 * sans saturer. Mesuré le 27/11 sur un film de 40 s : −21 LUFS sans ce gain.
 */
export const GAIN_VOIX = 1.8;
/** Fondu entre deux scènes. */
export const FONDU = 0.6;

export interface ScenePlacee {
  index: number;
  debut: number;
  fin: number;
  /** Début de la voix (absolu), si la scène en a une. */
  voixDebut?: number;
  voixDuree?: number;
  /** Vrai si la scène a été allongée pour que sa voix y tienne. */
  allongee: boolean;
}

export interface Calendrier {
  scenes: ScenePlacee[];
  total: number;
}

/**
 * Place les scènes bout à bout. Une scène dont la voix dure plus que prévu est
 * ALLONGÉE (et le dit) : couper la voix serait pire que décaler la suite.
 * `dureesVoix[i]` : durée de la voix générée de la scène i, ou absente.
 */
export function calendrier(scenes: readonly SceneFilm[], dureesVoix: readonly (number | undefined)[]): Calendrier {
  let t = 0;
  const placees: ScenePlacee[] = scenes.map((s, index) => {
    const dv = dureesVoix[index];
    const voix = s.voix.trim() && dv && dv > 0 ? dv : undefined;
    const besoin = voix ? AVANCE_VOIX + voix + MARGE_APRES_VOIX : 0;
    const duree = Math.max(s.duree, besoin);
    const p: ScenePlacee = {
      index,
      debut: arrondi(t),
      fin: arrondi(t + duree),
      allongee: duree > s.duree + 0.001,
      ...(voix ? { voixDebut: arrondi(t + AVANCE_VOIX), voixDuree: arrondi(voix) } : {}),
    };
    t += duree;
    return p;
  });
  return { scenes: placees, total: arrondi(t) };
}

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/** La scène affichée à l'instant t (la dernière au-delà de la fin). */
export function sceneA(cal: Calendrier, t: number): number {
  for (let i = 0; i < cal.scenes.length; i++) if (t < cal.scenes[i].fin) return i;
  return Math.max(0, cal.scenes.length - 1);
}

/** Opacité de la scène i à l'instant t : fondu d'entrée, rien de plus (la précédente reste dessous). */
export function opaciteEntree(cal: Calendrier, i: number, t: number): number {
  const s = cal.scenes[i];
  if (!s) return 0;
  if (i === 0) return Math.min(1, Math.max(0, (t - s.debut) / 0.8));
  return Math.min(1, Math.max(0, (t - s.debut) / FONDU));
}

/** Le sous-titre affiché à l'instant t : la voix de la scène, pendant qu'elle parle (et un peu après). */
export function sousTitreA(cal: Calendrier, scenes: readonly SceneFilm[], t: number): string {
  for (const p of cal.scenes) {
    if (p.voixDebut === undefined || p.voixDuree === undefined) continue;
    if (t >= p.voixDebut && t < p.voixDebut + p.voixDuree + 0.4) return scenes[p.index].voix;
  }
  return "";
}

/**
 * Enveloppe de la musique : pleine (0,5) hors voix, baissée (0,28) pendant
 * que la voix parle, éteinte à la fin. Mêmes valeurs que l'animatique de la
 * maquette, écoutées par l'éditeur. Rend des paliers [instant, gain, constante].
 */
export function paliersMusique(cal: Calendrier): [number, number, number][] {
  const p: [number, number, number][] = [];
  for (const s of cal.scenes) {
    if (s.voixDebut === undefined || s.voixDuree === undefined) continue;
    p.push([Math.max(0, s.voixDebut - 0.2), 0.28, 0.12]);
    p.push([s.voixDebut + s.voixDuree + 0.2, 0.5, 0.3]);
  }
  p.push([Math.max(0, cal.total - 2), 0.0001, 0.6]);
  return p;
}

/** Découpe un texte en lignes de sous-titre selon une fonction de mesure. */
export function lignesSousTitre(texte: string, largeurMax: number, mesure: (s: string) => number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let l = "";
  for (const m of mots) {
    const essai = l ? `${l} ${m}` : m;
    if (l && mesure(essai) > largeurMax) {
      lignes.push(l);
      l = m;
    } else l = essai;
  }
  if (l) lignes.push(l);
  return lignes;
}

export function nomFichierFilm(titre: string, date: Date): string {
  const base =
    titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "film";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.mp4`;
}
