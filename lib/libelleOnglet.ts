/**
 * Intitulé d'un onglet d'artefact, tiré de SON CONTEXTE et non de sa
 * catégorie.
 *
 * Les onglets s'appelaient « Tableau de bord », « Résumé de profil » — le type
 * technique de l'artefact. Cela ne dit rien de ce qu'on y trouve, range deux
 * sujets sans rapport sous la même étiquette dès qu'ils partagent une forme,
 * et parle au lecteur d'une taxonomie qui ne le concerne pas.
 *
 * Le titre, lui, porte le sujet : « Charles de Cassan — Parcours ». On en
 * retient la partie qui distingue, c'est-à-dire ce qui suit le tiret quand il
 * y en a un — le début nomme presque toujours le sujet commun à tous les
 * artefacts du gent, et le répéter sur chaque onglet ne distinguerait rien.
 *
 * Module PUR.
 */

/** Au-delà, un onglet devient une phrase et la barre se disloque. */
const MAX = 32;

/** Tirets ENTOURÉS d'espaces : « mi-2019 » ou « e-mail » ne se coupent pas. */
const SEPARATEUR = /\s[—–-]\s/;

function capitaliser(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

export function libelleOnglet(titre: string | null | undefined, repli: string): string {
  const t = typeof titre === "string" ? titre.trim() : "";
  if (!t) return repli;

  const bouts = t.split(SEPARATEUR).map((b) => b.trim()).filter(Boolean);
  // La DERNIÈRE partie : c'est elle qui qualifie (« … — Parcours »).
  const candidat = bouts.length > 1 ? bouts[bouts.length - 1] : t;

  // Un fragment d'un seul caractère ne nomme rien : on garde le titre entier.
  const retenu = candidat.length >= 2 ? candidat : t;
  const coupe = retenu.length > MAX ? `${retenu.slice(0, MAX - 1).trimEnd()}…` : retenu;
  return capitaliser(coupe) || repli;
}
