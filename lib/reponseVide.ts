/**
 * Réponse du gent qui n'affiche RIEN.
 *
 * Vécu sur un gent Gmail : les appels aux intégrations défilaient, puis la
 * bulle restait vide — la fonction serveur avait été coupée avant que le
 * modèle n'écrive, et rien ne le disait. Un état d'échec muet est pire
 * qu'une erreur : on nomme ce qui s'est passé et ce qu'on peut y faire.
 *
 * Module PUR.
 */
export const MESSAGE_REPONSE_VIDE =
  "<p><em>Le gent n'a rien renvoyé : sa réponse s'est arrêtée avant d'être rédigée — le plus souvent une limite " +
  "de durée, après de nombreux appels à ses outils. Réessayez en restreignant la demande (période plus courte, " +
  "moins d'éléments à analyser).</em></p>";

/** Vrai quand le HTML rendu ne contient aucun texte visible. */
export function estReponseVide(html: string | undefined): boolean {
  return !(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Connexion coupée PENDANT la réponse (« Failed to fetch », « network error ») :
 * ce n'est pas le service IA qui refuse, c'est le flux qui s'interrompt. Le
 * texte déjà reçu est GARDÉ — il était remplacé par l'erreur, et une réponse
 * à moitié écrite disparaissait.
 */
export const MESSAGE_CONNEXION_COUPEE =
  "<p><em>La connexion avec le gent a été coupée avant la fin de sa réponse (réseau, ou traitement trop long " +
  "côté serveur). Réessayez ; si cela se répète, restreignez la demande.</em></p>";

/**
 * Une coupure réseau : un TypeError AVEC le message d'un navigateur.
 *
 * Le type seul ne suffit pas. Un bug dans le traitement de la réponse
 * (« Cannot read properties of undefined… ») est lui aussi un TypeError : il
 * s'affichait comme une coupure, ce qui envoyait chercher du côté du réseau
 * alors que le serveur avait terminé normalement.
 */
const MESSAGES_RESEAU = /failed to fetch|network ?error|load failed|fetch failed|networkerror|connection (reset|closed)|terminated/i;

export function estCoupureReseau(err: unknown): boolean {
  return err instanceof TypeError && MESSAGES_RESEAU.test(err.message);
}

/** Erreur du navigateur qui n'est PAS une coupure : on la montre telle quelle. */
export function messageErreurTraitement(err: unknown): string {
  const detail = err instanceof Error && err.message ? err.message : "erreur inconnue";
  return (
    "<p><em>La réponse du gent est arrivée, mais son affichage a échoué (" +
    detail.replace(/[<>&]/g, "") +
    "). Réessayez ; si cela se répète, envoyez ce message à l'éditeur.</em></p>"
  );
}
