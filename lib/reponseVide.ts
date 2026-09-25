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

/** Une coupure réseau se reconnaît à son type : `fetch` la signale par un TypeError. */
export function estCoupureReseau(err: unknown): boolean {
  return err instanceof TypeError;
}
