import { ADRESSE_DEMANDE_ACCES } from "@/lib/inscriptions";

/**
 * Adresse où l'ÉDITEUR reçoit les notifications de la plateforme : demandes
 * d'accès, signalements, usage d'un lien.
 *
 * Elle se règle sur l'hébergeur (`ADRESSE_NOTIFICATIONS_EDITEUR`) et ne doit
 * apparaître NULLE PART ailleurs : c'est une adresse personnelle, et le dépôt
 * est public. Ni dans le code, ni dans les journaux, ni dans une réponse au
 * navigateur. Vécu (13/11) : les demandes partaient vers CEO@getgents.ai,
 * acceptées par Brevo — et n'arrivaient dans aucune boîte lue.
 *
 * Absente ou mal formée : repli sur l'adresse publique de contact.
 */
const FORME = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;

export type OrigineAdresse = "reglee" | "defaut" | "invalide";

/** Fonction pure sur l'environnement passé : testable sans rien régler. */
export function choisirAdresseEditeur(env: { ADRESSE_NOTIFICATIONS_EDITEUR?: string }): {
  adresse: string;
  origine: OrigineAdresse;
} {
  const brute = env.ADRESSE_NOTIFICATIONS_EDITEUR?.trim();
  if (!brute) return { adresse: ADRESSE_DEMANDE_ACCES, origine: "defaut" };
  if (!FORME.test(brute)) return { adresse: ADRESSE_DEMANDE_ACCES, origine: "invalide" };
  return { adresse: brute, origine: "reglee" };
}

let invaliditeSignalee = false;

/** L'adresse à utiliser, et d'où elle vient (pour le journal — jamais l'adresse). */
export function adresseNotificationsEditeur(): { adresse: string; origine: OrigineAdresse } {
  const choix = choisirAdresseEditeur({ ADRESSE_NOTIFICATIONS_EDITEUR: process.env.ADRESSE_NOTIFICATIONS_EDITEUR });
  if (choix.origine === "invalide" && !invaliditeSignalee) {
    invaliditeSignalee = true;
    console.error(JSON.stringify({ tag: "getgents:email", event: "adresse_editeur_invalide" }));
  }
  return choix;
}
