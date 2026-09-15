/**
 * Normalisation des adresses d'invitation.
 *
 * Une invitation vise une ADRESSE, pas un compte : le destinataire n'est le
 * plus souvent pas encore inscrit. L'adresse devient donc une clé, et deux
 * écritures de la même adresse doivent se rejoindre — sans quoi « Marie@ex.fr »
 * et « marie@ex.fr » ouvriraient deux invitations concurrentes sur le même
 * gent, avec deux rôles possiblement contradictoires.
 *
 * Ce qu'on ne fait PAS, délibérément : retirer les points d'une adresse Gmail
 * ni couper les `+tag`. Ces règles sont propres à certains fournisseurs, elles
 * changent, et les appliquer ferait qu'inviter « marie+getgents@gmail.com »
 * donnerait l'accès à « marie@gmail.com » — surprenant, et impossible à
 * expliquer à qui découvre le comportement.
 *
 * Module PUR — testable.
 */

export function normalizeEmail(brut: string): string {
  return brut.trim().toLowerCase();
}

/**
 * Contrôle volontairement large : la seule validation qui compte est qu'un
 * e-mail parte et arrive. Refuser des adresses valides mais inhabituelles
 * coûte plus cher que d'en accepter une qui rebondira.
 */
export function estEmailPlausible(email: string): boolean {
  const e = normalizeEmail(email);
  if (e.length < 6 || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  const parties = e.split("@");
  if (parties.length !== 2) return false;
  const [locale, domaine] = parties;
  if (!locale || !domaine) return false;
  if (!domaine.includes(".")) return false;
  if (domaine.startsWith(".") || domaine.endsWith(".") || domaine.includes("..")) return false;
  return true;
}

/** Une personne ne s'invite pas elle-même : le geste n'a aucun sens. */
export function estSoiMeme(invite: string, soi: string | null): boolean {
  return !!soi && normalizeEmail(invite) === normalizeEmail(soi);
}
