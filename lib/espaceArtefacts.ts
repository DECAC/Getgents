import type { Espace } from "@/lib/types";

/**
 * Le gent a-t-il DÉJÀ produit quelque chose à montrer ?
 *
 * Deux sources, et il faut les deux : les modules de l'aperçu d'application
 * (`appPreview`), que l'assistant du builder fabrique, et les artefacts gardés
 * au fil de la conversation. Ne regarder que l'une des deux ferait passer un
 * espace bien rempli pour vide.
 *
 * Sert à décider si l'onglet « Le gent » montre le canevas ou un mot
 * d'explication — et à ouvrir le panneau quand un artefact vient d'arriver.
 *
 * Module PUR.
 */
export function nombreDArtefacts(espace: Espace | null | undefined): number {
  if (!espace) return 0;
  return (espace.appPreview?.modules.length ?? 0) + (espace.artefacts?.length ?? 0);
}

export function aDesArtefacts(espace: Espace | null | undefined): boolean {
  return nombreDArtefacts(espace) > 0;
}

/**
 * Un espace vide sans un mot est un cul-de-sac : le visiteur clique « Le
 * gent », ne trouve rien, et n'a aucune raison de recommencer plus tard. La
 * phrase explique la mécanique — les artefacts NAISSENT de la conversation.
 */
export const MESSAGE_ESPACE_VIDE =
  "Rien ici pour l'instant — et c'est normal : les documents, tableaux de bord et " +
  "synthèses que ce gent produit naissent de vos échanges. Posez-lui une question, " +
  "et ce qu'il fabriquera se rangera ici.";
