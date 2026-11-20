// « Nous contacter », section de Mon compte : un message libre d'un compte
// connecté, envoyé par e-mail à l'éditeur.
//
// Module PUR : validation et corps de l'e-mail. Pas de choix « idée /
// question » (décision de l'éditeur, 20/11) : un seul champ, on écrit ce
// qu'on veut.

export const CONTACT_MIN = 5;
export const CONTACT_MAX = 2000;

export type ProblemeContact = "vide" | "court" | "long";

export const MESSAGE_CONTACT: Record<ProblemeContact | "trop" | "envoi", string> = {
  vide: "Écrivez votre message avant d'envoyer.",
  court: "Votre message est un peu court : dites-nous en un peu plus.",
  long: `Votre message dépasse ${CONTACT_MAX} caractères : resserrez-le un peu.`,
  trop: "Vous avez envoyé plusieurs messages en peu de temps. Réessayez dans une heure.",
  envoi: "Le message n'est pas parti. Réessayez dans un instant : votre texte est gardé.",
};

/** Texte nettoyé, tel qu'il sera envoyé. */
export function normaliserMessage(brut: string): string {
  return (brut ?? "").replace(/\r\n/g, "\n").trim();
}

/** Le problème du message, ou `null` s'il est recevable. */
export function validerMessage(brut: string): ProblemeContact | null {
  const t = normaliserMessage(brut);
  if (!t) return "vide";
  if (t.length < CONTACT_MIN) return "court";
  if (t.length > CONTACT_MAX) return "long";
  return null;
}

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Objet de l'e-mail : préfixe fixe (pour filtrer dans la boîte) + début du message. */
export function objetContact(message: string): string {
  const t = normaliserMessage(message).replace(/\s+/g, " ");
  const debut = t.length > 60 ? `${t.slice(0, 60).trimEnd()}…` : t;
  return `[Getgents · Contact] ${debut}`;
}

export interface Expediteur {
  email: string | null;
  nomAffiche: string;
  userId: string;
  offre: string;
}

/**
 * Corps HTML reçu par l'éditeur. Tout ce qu'a écrit l'utilisateur est
 * ÉCHAPPÉ, son nom affiché compris.
 */
export function corpsEmailContact(message: string, de: Expediteur, date: Date = new Date()): string {
  const quand = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
  const texte = echapper(normaliserMessage(message)).replace(/\n/g, "<br>");
  const qui = de.nomAffiche.trim() ? `${echapper(de.nomAffiche.trim())} · ` : "";
  const adresse = de.email ? echapper(de.email) : "adresse non confirmée — « Répondre » n'atteindra personne";
  return (
    `<p><b>Message depuis Mon compte</b> — ${echapper(quand)}</p>` +
    `<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:3px solid #e65d76">${texte}</blockquote>` +
    `<p style="color:#777;font-size:13px">${qui}${adresse}<br>Offre : ${echapper(de.offre)} · compte ${echapper(de.userId)}</p>` +
    (de.email ? `<p style="color:#777;font-size:13px">« Répondre » écrit directement à cette personne.</p>` : "")
  );
}
