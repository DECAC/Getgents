/**
 * « En savoir plus » sur un passage surligné d'une réponse du gent.
 *
 * La demande part comme un message ordinaire, visible dans le fil : on voit
 * ce qu'on a demandé, le gent garde tout le contexte de la conversation, et
 * peut utiliser ses outils (recherche web, Gmail…) pour creuser.
 *
 * Module PUR.
 */

/** En deçà, une sélection est un clic hésitant, pas un passage. */
export const EXTRAIT_MIN = 8;
/** Au-delà, l'extrait est coupé : c'est un repère pour le gent, pas une copie. */
export const EXTRAIT_MAX = 600;

/** Le passage sélectionné, nettoyé — ou null s'il est trop court pour servir. */
export function extraitSelection(texte: string | null | undefined): string | null {
  const net = (texte ?? "").replace(/\s+/g, " ").trim();
  if (net.length < EXTRAIT_MIN) return null;
  return net.length > EXTRAIT_MAX ? `${net.slice(0, EXTRAIT_MAX - 1).trimEnd()}…` : net;
}

export function demandeEnSavoirPlus(extrait: string): string {
  return (
    `En savoir plus sur ce passage de ta réponse : « ${extrait} »\n\n` +
    "Approfondis-le : contexte, détails, exemples concrets et ce qu'il faut en retenir. " +
    "Si tu disposes d'outils pour vérifier ou compléter, utilise-les."
  );
}
