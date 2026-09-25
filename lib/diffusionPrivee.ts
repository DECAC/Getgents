import { slugSuivant, toSlug } from "@/lib/slug";

/**
 * Diffusion PRIVÉE : le gent est réservé à l'usage de son créateur.
 *
 * - Il s'ouvre depuis GetSpace à une adresse lisible, sans `draft-…` :
 *   `/espace/<adressePrivee>` (ex. `/espace/assistant-email`). L'adresse est
 *   résolue dans le navigateur, parmi les gents du compte — elle n'a de sens
 *   que pour lui, et ne donne rien à un autre compte.
 * - Tous les autres modes de publication sont fermés, côté serveur
 *   (`gentPrive`, lib/server/gentVersions.ts) : page publique, liens de
 *   partage, salon, invitations, WhatsApp entrant.
 *
 * Module PUR.
 */

/** Adresse privée unique parmi celles déjà prises par les gents du compte. */
export function adressePriveePour(nom: string, prises: Iterable<string>): string {
  return slugSuivant(toSlug(nom) || "mon-gent", prises);
}

export function cheminPrive(adresse: string): string {
  return `/espace/${encodeURIComponent(adresse)}`;
}

/** Chemin de l'espace personnel d'un gent : l'adresse privée quand il en a une. */
export function cheminEspace(id: string, espace?: { diffusionPrivee?: boolean; adressePrivee?: string }): string {
  return espace?.diffusionPrivee && espace.adressePrivee ? cheminPrive(espace.adressePrivee) : `/espace/${encodeURIComponent(id)}`;
}
