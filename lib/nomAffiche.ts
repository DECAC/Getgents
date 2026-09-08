/**
 * Nom affiché publiquement : « Proposé par … ».
 *
 * Ce réglage avait été explicitement REPORTÉ au lot 8, et pour une bonne
 * raison : rien ne l'affichait nulle part. Un champ que personne ne voit est
 * un champ que personne ne remplit, et qu'on finit par oublier de tenir à
 * jour. Il devient utile maintenant qu'un gent publié porte une attribution.
 *
 * Deux niveaux, du plus précis au plus général :
 *   1. le nom posé SUR CE GENT — un même créateur peut publier sous le nom de
 *      son entreprise ici, et sous le sien là ;
 *   2. à défaut, le nom du compte.
 * Sans ni l'un ni l'autre, aucune attribution n'est affichée : « Proposé par »
 * suivi d'un vide, ou d'une adresse e-mail, serait pire que rien — dans le
 * second cas ce serait même divulguer l'adresse du créateur.
 *
 * Module PUR — testable.
 */

export const NOM_AFFICHE_MAX = 60;

/**
 * Nettoie un nom saisi.
 *
 * Les retours à la ligne et les espaces multiples sont écrasés : le nom est
 * rendu sur une seule ligne, et un nom contenant un saut de ligne casserait la
 * mise en page sans que son auteur comprenne pourquoi.
 */
export function normaliserNomAffiche(brut: unknown): string {
  if (typeof brut !== "string") return "";
  return brut.replace(/\s+/g, " ").trim().slice(0, NOM_AFFICHE_MAX);
}

/**
 * Un nom est-il acceptable ?
 *
 * On refuse ce qui ressemble à une adresse e-mail : c'est l'erreur naturelle
 * — le champ est proche de celui de l'adresse — et la publier exposerait le
 * créateur aux robots collecteurs sur une page indexée.
 */
export function nomAfficheValide(nom: string): boolean {
  const v = normaliserNomAffiche(nom);
  if (v.length < 2) return false;
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export const MESSAGE_NOM_INVALIDE =
  "Indiquez un nom d'au moins deux caractères — pas une adresse e-mail, qui serait visible de tous.";

/**
 * Attribution affichée sous un gent publié. `null` quand il n'y a rien de
 * présentable : l'appelant n'affiche alors pas la ligne du tout.
 */
export function attributionPublique(
  nomDuGent: string | null | undefined,
  nomDuCompte: string | null | undefined
): string | null {
  const surLeGent = normaliserNomAffiche(nomDuGent);
  if (surLeGent) return surLeGent;
  const duCompte = normaliserNomAffiche(nomDuCompte);
  return duCompte || null;
}
