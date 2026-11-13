// Demande d'accès à Getgents, déposée par un visiteur depuis /inscription.
//
// Module PUR : validation et corps de l'e-mail envoyé à l'éditeur.

export interface DemandeAcces {
  email: string;
  motivation: string;
  /** Champ piège, invisible pour un humain : rempli, c'est un robot. */
  piege?: string;
}

export const MOTIVATION_MIN = 20;
export const MOTIVATION_MAX = 1500;

export type ProblemeDemande = "email" | "motivation_courte" | "motivation_longue" | "robot";

export const MESSAGE_DEMANDE: Record<ProblemeDemande | "trop" | "serveur", string> = {
  email: "Cette adresse e-mail ne semble pas valide.",
  motivation_courte: `Dites-nous en quelques mots ce que vous aimeriez construire (${MOTIVATION_MIN} caractères au moins).`,
  motivation_longue: `Votre message dépasse ${MOTIVATION_MAX} caractères : resserrez-le un peu.`,
  robot: "La demande n'a pas pu être envoyée.",
  trop: "Vous avez déjà envoyé une demande récemment. Nous vous répondrons à cette adresse.",
  serveur: "La demande n'a pas pu être enregistrée. Réessayez dans un instant.",
};

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;

/** Adresse et motivation nettoyées, telles qu'elles seront gardées. */
export function normaliserDemande(d: DemandeAcces): DemandeAcces {
  return {
    email: (d.email ?? "").trim().toLowerCase(),
    motivation: (d.motivation ?? "").replace(/\r\n/g, "\n").trim(),
    piege: (d.piege ?? "").trim(),
  };
}

/** Le premier problème de la demande, ou `null` si elle est recevable. */
export function validerDemande(brute: DemandeAcces): ProblemeDemande | null {
  const d = normaliserDemande(brute);
  if (d.piege) return "robot";
  if (!EMAIL.test(d.email)) return "email";
  if (d.motivation.length < MOTIVATION_MIN) return "motivation_courte";
  if (d.motivation.length > MOTIVATION_MAX) return "motivation_longue";
  return null;
}

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Corps HTML de l'e-mail reçu par l'éditeur. Tout ce qu'a écrit le visiteur
 * est ÉCHAPPÉ : c'est du texte venu d'un formulaire public.
 */
export function corpsEmailDemande(d: DemandeAcces, date: Date = new Date()): string {
  const quand = date.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
  const motivation = echapper(d.motivation).replace(/\n/g, "<br>");
  return (
    `<p><b>Nouvelle demande d'accès à Getgents</b> — ${echapper(quand)}</p>` +
    `<p><b>Adresse :</b> ${echapper(d.email)}</p>` +
    `<p><b>Ce que la personne aimerait construire :</b></p>` +
    `<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:3px solid #ccc">${motivation}</blockquote>` +
    `<p style="color:#777">« Répondre » écrit directement à cette personne.</p>`
  );
}
