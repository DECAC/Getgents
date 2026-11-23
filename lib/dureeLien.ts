/**
 * Durée de vie d'un lien de partage et prolongation (lot « Partager »,
 * 23/11). Module PUR, partagé par le serveur, la fiche et les e-mails.
 *
 * Un lien dure 30 jours. PROLONGER le refait durer 30 jours À PARTIR
 * D'AUJOURD'HUI (pas un ajout à l'ancienne date) : un lien ne dépasse donc
 * jamais 30 jours sans que l'auteur l'ait voulu. Le lien et son QR code ne
 * changent pas — ce qui est déjà imprimé ou envoyé continue de marcher.
 */

export const JOUR_MS = 24 * 3600 * 1000;
export const DUREE_LIEN_MS = 30 * JOUR_MS;

/** Le bandeau de la fiche prévient quand un lien expire dans moins de 7 jours. */
export const SEUIL_BANDEAU_JOURS = 7;
/** L'e-mail de rappel part à moins de 48 h de l'échéance (choix de l'éditeur, 23/11). */
export const SEUIL_RAPPEL_HEURES = 48;

export function nouvelleEcheance(maintenant: number = Date.now()): string {
  return new Date(maintenant + DUREE_LIEN_MS).toISOString();
}

export interface LienEcheance {
  expiresAt: string | null;
  revokedAt: string | null;
}

export type EtatEcheance = "revoque" | "expire" | "bientot" | "actif";

/** Où en est un lien : révoqué (définitif), expiré, bientôt expiré (< 7 jours), actif. */
export function etatEcheance(l: LienEcheance, maintenant: number = Date.now(), seuilJours: number = SEUIL_BANDEAU_JOURS): EtatEcheance {
  if (l.revokedAt) return "revoque";
  if (!l.expiresAt) return "actif";
  const reste = Date.parse(l.expiresAt) - maintenant;
  if (reste <= 0) return "expire";
  return reste < seuilJours * JOUR_MS ? "bientot" : "actif";
}

/** « expire dans moins de 24 h », « expire dans 3 jours ». */
export function texteExpireDans(expiresAt: string, maintenant: number = Date.now()): string {
  const reste = Date.parse(expiresAt) - maintenant;
  if (reste < JOUR_MS) return "expire dans moins de 24 h";
  return `expire dans ${Math.ceil(reste / JOUR_MS)} jours`;
}

/** Un lien peut-il être prolongé ? Actif ou expiré, jamais révoqué. */
export function peutProlonger(l: LienEcheance): boolean {
  return !l.revokedAt && !!l.expiresAt;
}

/** Les liens à prolonger d'un coup depuis le bandeau : actifs, expirant dans moins de 7 jours. */
export function liensQuiExpirent<T extends LienEcheance>(liens: T[], maintenant: number = Date.now()): T[] {
  return liens.filter((l) => etatEcheance(l, maintenant) === "bientot");
}
