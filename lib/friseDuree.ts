/**
 * Durée d'une étape de frise, déduite de sa date.
 *
 * ARBITRAGE VALIDÉ : on ne calcule QUE lorsque la plage est reconnue avec
 * certitude. Sinon on n'affiche rien — jamais d'approximation. Une frise de
 * parcours sert à établir des faits ; une durée fausse y est pire qu'une durée
 * absente, parce qu'elle a l'air d'une donnée.
 *
 * Les formes reconnues sont volontairement peu nombreuses et strictes :
 *
 *   « 2015 — 2018 »            → 3 ans
 *   « 2018 - 2022 »            → 4 ans      (tiret simple, en, ou cadratin)
 *   « 2022 — aujourd'hui »     → depuis l'année en cours
 *   « mars 2019 — juin 2021 »  → 2 ans 3 mois
 *
 * Tout le reste — une date seule, « Migration 018 », « T3 2025 » — ne produit
 * rien. C'est le comportement voulu, pas une lacune.
 *
 * Module PUR : l'année courante est un PARAMÈTRE, jamais `new Date()` lu ici,
 * sans quoi la fonction ne serait pas testable et changerait de résultat au
 * 1er janvier.
 */

const MOIS: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

const EN_COURS = /^(aujourd'hui|aujourdhui|present|présent|maintenant|en cours)$/i;

/** Sépare sur un tiret entouré d'espaces — jamais sur celui de « mi-2019 ». */
const SEPARATEUR = /\s+[—–-]\s+/;

interface Point {
  annee: number;
  mois?: number;
}

function lirePoint(v: string): Point | "en_cours" | null {
  const t = v.trim();
  if (!t) return null;
  if (EN_COURS.test(t)) return "en_cours";

  const seule = /^(\d{4})$/.exec(t);
  if (seule) return { annee: Number(seule[1]) };

  // Pas de `\p{L}` : la cible TypeScript du projet refuse le drapeau unicode.
  // « tout sauf espace et chiffre » suffit — le dictionnaire des mois valide.
  const avecMois = /^([^\s\d]+)\s+(\d{4})$/.exec(t);
  if (avecMois) {
    const mois = MOIS[avecMois[1].toLowerCase()];
    if (!mois) return null;
    return { annee: Number(avecMois[2]), mois };
  }
  return null;
}

function formuler(mois: number): string | null {
  if (mois < 1) return null;
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  if (!ans) return `${reste} mois`;
  const partAns = `${ans} an${ans > 1 ? "s" : ""}`;
  return reste ? `${partAns} ${reste} mois` : partAns;
}

/**
 * `null` quand la plage n'est pas reconnue — l'appelant n'affiche alors rien.
 * `anneeCourante` sert uniquement aux plages ouvertes (« … — aujourd'hui »).
 */
export function dureeDeLaPlage(date: string, anneeCourante: number): string | null {
  if (typeof date !== "string") return null;
  const bouts = date.split(SEPARATEUR);
  if (bouts.length !== 2) return null;

  const debut = lirePoint(bouts[0]);
  const fin = lirePoint(bouts[1]);
  if (!debut || debut === "en_cours" || !fin) return null;

  const finPoint: Point = fin === "en_cours" ? { annee: anneeCourante } : fin;

  // Sans mois de part et d'autre, on raisonne en années pleines : « 2015 —
  // 2018 » vaut 3 ans, pas « 2 ans 11 mois ».
  if (debut.mois === undefined || finPoint.mois === undefined) {
    return formuler((finPoint.annee - debut.annee) * 12);
  }
  return formuler((finPoint.annee - debut.annee) * 12 + (finPoint.mois - debut.mois));
}
