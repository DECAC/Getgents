"use client";

import { cancelPendingPushes, resetPublishedRemoteAvailability } from "@/lib/publishedGents";
import { cancelPendingDraftPushes, resetDraftsRemoteAvailability } from "@/lib/builderDraftStorage";
import { setStorageUser } from "@/lib/session/currentUser";

/**
 * Bascule du cache local vers un autre compte — ou vers personne.
 *
 * L'ordre compte. On annule D'ABORD les envois en attente : un push différé
 * qui partirait après le changement de session écrirait dans les données du
 * compte suivant. On purge ensuite, puis on réarme les drapeaux de
 * disponibilité, sans quoi un 401 antérieur laisserait la synchronisation
 * éteinte pour toute la session du nouveau venu.
 *
 * Renvoie `true` si le compte a changé — l'interface doit alors relire ses
 * données depuis le serveur.
 */
export function basculerCompte(userId: string | null): boolean {
  cancelPendingPushes();
  cancelPendingDraftPushes();

  const change = setStorageUser(userId);

  resetPublishedRemoteAvailability();
  resetDraftsRemoteAvailability();
  return change;
}
