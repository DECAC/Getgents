/**
 * Intitulé d'un onglet d'artefact, tiré de SON CONTEXTE et non de sa
 * catégorie.
 *
 * Les onglets s'appelaient « Tableau de bord », « Résumé de profil » — le type
 * technique de l'artefact. Cela ne dit rien de ce qu'on y trouve, range deux
 * sujets sans rapport sous la même étiquette dès qu'ils partagent une forme,
 * et parle au lecteur d'une taxonomie qui ne le concerne pas.
 *
 * Le titre, lui, porte le sujet. Quand il est en deux parties séparées par un
 * tiret, l'une nomme ce que contient l'artefact, l'autre souvent la personne
 * ou le sujet commun à tout le gent — et la répéter sur chaque onglet ne
 * distinguerait rien. L'ordre varie selon le modèle :
 *   « Parcours professionnel — Charles de Cassan » → « Parcours professionnel »
 *   « Charles de Cassan — Parcours »               → « Parcours »
 * On écarte donc la partie qui ressemble à un nom propre, ou qui ne fait que
 * répéter le nom du gent, et l'on garde la PREMIÈRE partie restante : en
 * français, le titre nomme d'abord la chose, puis la précise.
 *
 * Une première version gardait systématiquement la DERNIÈRE partie : elle
 * donnait « Charles de Cassan » pour le premier exemple ci-dessus.
 *
 * Module PUR.
 */

/** Au-delà, un onglet devient une phrase et la barre se disloque. */
const MAX = 32;

/** Tirets ENTOURÉS d'espaces : « mi-2019 » ou « e-mail » ne se coupent pas. */
const SEPARATEUR = /\s[—–-]\s/;

/** Particules qui ne comptent pas pour décider qu'une suite de mots est un nom propre. */
const PARTICULES = new Set(["de", "du", "des", "d'", "la", "le", "les", "van", "von", "der", "di", "da", "del", "et", "&"]);

function capitaliser(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

function mots(v: string): string[] {
  return v
    .toLowerCase()
    .split(/[\s'’,.:;()]+/)
    .filter((m) => m.length >= 2 && !PARTICULES.has(m));
}

/**
 * « Charles de Cassan », « Jeanne Martin » : au moins deux mots significatifs,
 * tous commençant par une majuscule. « Parcours professionnel » n'en est pas un
 * — le second mot est en minuscule.
 */
function ressembleANomPropre(partie: string): boolean {
  const significatifs = partie
    .split(/\s+/)
    .filter((m) => m.length >= 2 && !PARTICULES.has(m.toLowerCase()));
  if (significatifs.length < 2) return false;
  // Majuscule, accents compris ; un chiffre n'en est pas une (« 2026 »).
  return significatifs.every((m) => m.charAt(0) !== m.charAt(0).toLowerCase());
}

/** Tous les mots de la partie figurent déjà dans le nom du gent : elle ne distingue rien. */
function repeteLeContexte(partie: string, contexte: ReadonlySet<string>): boolean {
  if (!contexte.size) return false;
  const m = mots(partie);
  return m.length > 0 && m.every((x) => contexte.has(x));
}

/**
 * @param contexte noms qui désignent le gent tout entier (nom du gent, de
 *   l'espace) : une partie de titre qui ne fait que les répéter est écartée.
 */
export function libelleOnglet(
  titre: string | null | undefined,
  repli: string,
  contexte: readonly (string | null | undefined)[] = []
): string {
  const t = typeof titre === "string" ? titre.trim() : "";
  if (!t) return repli;

  const motsContexte = new Set(contexte.flatMap((c) => (typeof c === "string" ? mots(c) : [])));
  // Un fragment d'un seul caractère ne nomme rien.
  const bouts = t
    .split(SEPARATEUR)
    .map((b) => b.trim())
    .filter((b) => b.length >= 2);

  let retenu = t;
  if (bouts.length > 1) {
    const distinctifs = bouts.filter((b) => !ressembleANomPropre(b) && !repeteLeContexte(b, motsContexte));
    retenu = distinctifs[0] ?? bouts[0];
  } else if (bouts.length === 1) {
    retenu = bouts[0];
  }

  const coupe = retenu.length > MAX ? `${retenu.slice(0, MAX - 1).trimEnd()}…` : retenu;
  return capitaliser(coupe) || repli;
}
