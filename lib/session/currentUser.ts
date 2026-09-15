"use client";

import { DERNIER_COMPTE, scopedKey, staleScopedKeys } from "@/lib/storageScope";

/**
 * Compte auquel appartient le cache local, côté navigateur.
 *
 * Les modules de stockage (`publishedGents`, `builderDraftStorage`) sont des
 * fonctions synchrones appelées au rendu : elles ne peuvent pas attendre une
 * requête d'identité. On mémorise donc le compte ici, renseigné dès que la
 * session est connue, et lu à chaque accès au cache.
 *
 * Avant que la session soit lue, `null` fait retomber sur les clés nues : le
 * comportement d'origine, sans cloisonnement — il n'y a alors personne à
 * cloisonner.
 */
let compteCourant: string | null = null;

export function currentStorageUser(): string | null {
  if (compteCourant) return compteCourant;
  if (typeof window === "undefined") return null;
  try {
    compteCourant = window.localStorage.getItem(DERNIER_COMPTE);
  } catch {
    compteCourant = null;
  }
  return compteCourant;
}

/** Clé de cache du compte courant. */
export function cacheKey(base: string): string {
  return scopedKey(base, currentStorageUser());
}

/**
 * Déclare le compte connecté, et fait le ménage si ce n'est plus le même.
 *
 * Renvoie `true` quand le compte a changé — l'appelant doit alors relire ses
 * données depuis le serveur, le cache venant d'être vidé sous ses pieds.
 */
export function setStorageUser(userId: string | null): boolean {
  const precedent = currentStorageUser();
  if (precedent === userId) return false;

  compteCourant = userId;
  if (typeof window === "undefined") return true;

  try {
    // Reprise des données d'avant le cloisonnement : plutôt que de les
    // effacer, on les rattache au premier compte qui se connecte — le même
    // geste que la reprise des gents orphelins côté serveur. Sans cela, un
    // créateur qui met à jour l'application verrait son cache disparaître.
    if (userId && !precedent) {
      for (const base of ["getgents:published-gents", "getgents:gent-drafts"]) {
        const nue = window.localStorage.getItem(base);
        const cible = scopedKey(base, userId);
        if (nue && !window.localStorage.getItem(cible)) {
          window.localStorage.setItem(cible, nue);
        }
      }
    }

    for (const cle of staleScopedKeys(Object.keys(window.localStorage), userId)) {
      window.localStorage.removeItem(cle);
    }

    if (userId) window.localStorage.setItem(DERNIER_COMPTE, userId);
    else window.localStorage.removeItem(DERNIER_COMPTE);
  } catch {
    // localStorage indisponible : rien à purger.
  }
  return true;
}
