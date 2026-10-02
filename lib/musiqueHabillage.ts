/**
 * Musiques d'habillage GÉNÉRÉES : la partition est écrite ici (module pur),
 * le son est synthétisé dans le navigateur (components/habillage/synthese.ts).
 *
 * Pourquoi générer plutôt que fournir des morceaux : aucun fichier à
 * héberger, et surtout aucun droit à vérifier — une musique protégée peut
 * valoir à la vidéo d'être rendue muette sur LinkedIn. Contrepartie : ce
 * sont des fonds sonores (nappes, rythmes simples), pas des morceaux
 * produits. Ils restent bas sous la voix (`enveloppeMusique`). Pour mieux,
 * l'utilisateur importe sa musique, dont il porte alors les droits.
 */

export type Instrument = "nappe" | "pince" | "piano" | "basse" | "grosseCaisse" | "caisse" | "charley";

export interface NoteMusique {
  t: number;
  duree: number;
  /** Hauteur MIDI (60 = do central) ; ignorée par les percussions. */
  hauteur: number;
  instrument: Instrument;
  /** 0 à 1. */
  force: number;
}

export type StyleGenere = "inspirant" | "energique" | "lofi" | "corporate";

interface Recette {
  tempo: number;
  /** Accords, un par mesure de 4 temps, en hauteurs MIDI. */
  accords: number[][];
  /** Coupure du filtre général : un lo-fi est sourd, un énergique brillant. */
  coupure: number;
}

const RECETTES: Record<StyleGenere, Recette> = {
  // Do – Sol – La m – Fa : la progression la plus « lumineuse » qui soit.
  inspirant: { tempo: 72, coupure: 5000, accords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] },
  // La m – Fa – Do – Sol, tempo de marche rapide.
  energique: { tempo: 118, coupure: 9000, accords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]] },
  // Accords de septième (ré m7 – sol 7 – do maj7 – la m7) : la couleur jazz du lo-fi.
  lofi: { tempo: 78, coupure: 2600, accords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]] },
  corporate: { tempo: 100, coupure: 7000, accords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]] },
};

export function tempoDe(style: StyleGenere): number {
  return RECETTES[style].tempo;
}

export function coupureDe(style: StyleGenere): number {
  return RECETTES[style].coupure;
}

export function frequence(hauteur: number): number {
  return 440 * Math.pow(2, (hauteur - 69) / 12);
}

/** La partition de `duree` secondes, mesure après mesure. */
export function partition(style: StyleGenere, duree: number): NoteMusique[] {
  const { tempo, accords } = RECETTES[style];
  const temps = 60 / tempo;
  const mesure = temps * 4;
  const notes: NoteMusique[] = [];
  const ajoute = (t: number, d: number, hauteur: number, instrument: Instrument, force: number) => {
    if (t < duree) notes.push({ t, duree: Math.min(d, duree - t), hauteur, instrument, force });
  };

  for (let m = 0; m * mesure < duree; m++) {
    const debut = m * mesure;
    const accord = accords[m % accords.length];
    const fondamentale = accord[0] - 12;
    switch (style) {
      case "inspirant":
        accord.forEach((h) => ajoute(debut, mesure, h, "nappe", 0.5));
        // Arpège en croches, une octave au-dessus, léger.
        for (let c = 0; c < 8; c++) ajoute(debut + c * (temps / 2), temps, accord[c % accord.length] + 12, "pince", 0.35);
        break;
      case "energique":
        for (let b = 0; b < 4; b++) {
          ajoute(debut + b * temps, temps, 0, "grosseCaisse", 0.9);
          if (b % 2 === 1) ajoute(debut + b * temps, temps, 0, "caisse", 0.6);
          for (let c = 0; c < 2; c++) ajoute(debut + b * temps + c * (temps / 2), temps / 2, 0, "charley", c ? 0.5 : 0.3);
          // Basse en croches sur la fondamentale.
          for (let c = 0; c < 2; c++) ajoute(debut + b * temps + c * (temps / 2), temps / 2, fondamentale, "basse", 0.7);
          // Accord à contretemps.
          accord.forEach((h) => ajoute(debut + b * temps + temps / 2, temps / 3, h + 12, "pince", 0.3));
        }
        break;
      case "lofi":
        accord.forEach((h) => ajoute(debut, mesure * 0.95, h, "piano", 0.45));
        ajoute(debut, temps, 0, "grosseCaisse", 0.6);
        ajoute(debut + temps * 2.5, temps, 0, "grosseCaisse", 0.45);
        ajoute(debut + temps, temps, 0, "caisse", 0.35);
        ajoute(debut + temps * 3, temps, 0, "caisse", 0.35);
        // Charleston « swingué » : la seconde croche arrive en retard.
        for (let b = 0; b < 4; b++) {
          ajoute(debut + b * temps, temps / 2, 0, "charley", 0.25);
          ajoute(debut + b * temps + temps * 0.66, temps / 3, 0, "charley", 0.15);
        }
        ajoute(debut, mesure, fondamentale, "basse", 0.5);
        break;
      case "corporate":
        accord.forEach((h) => ajoute(debut, mesure, h, "nappe", 0.3));
        for (let c = 0; c < 8; c++) {
          const h = accord[[0, 1, 2, 1][c % 4]] + 12;
          ajoute(debut + c * (temps / 2), temps / 2, h, "pince", 0.45);
        }
        ajoute(debut, temps, 0, "grosseCaisse", 0.5);
        ajoute(debut + temps * 2, temps, 0, "grosseCaisse", 0.5);
        for (let b = 0; b < 4; b++) ajoute(debut + b * temps + temps / 2, temps / 2, 0, "charley", 0.25);
        ajoute(debut, mesure, fondamentale, "basse", 0.4);
        break;
    }
  }
  return notes;
}
