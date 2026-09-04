/**
 * Réponses à un lot de questions du fil privé.
 *
 * Le bug que ce module corrige : un message de l'orchestrateur peut poser
 * PLUSIEURS questions (« tes disponibilités ? », « préférence d'activité ? »,
 * « airbnb ou hôtel ? »). L'interface envoyait la réponse dès le premier clic
 * sur une option à choix unique. Conséquences en chaîne, toutes observées :
 *
 *   1. le participant n'avait répondu qu'à une question sur trois ;
 *   2. l'orchestrateur, voyant deux questions sans réponse, les reposait —
 *      ce qui se lit à l'écran comme un doublon, puis un triplon ;
 *   3. chaque clic déclenchait un appel LLM complet, non diffusé en continu.
 *      Trois questions coûtaient trois attentes au lieu d'une.
 *
 * La sélection était de surcroît indexée par MESSAGE et non par question :
 * répondre à la deuxième question écrasait la réponse à la première.
 *
 * D'où ce module : une réponse par question, un envoi quand tout est répondu.
 *
 * Module PUR — testable sans navigateur.
 */

export interface QuestionPosee {
  q: string;
  options: string[];
  multi?: boolean;
}

/** Sélections en cours, par index de question dans le message. */
export type SelectionsParQuestion = Record<number, string[]>;

/**
 * Clé de sélection : le message ET l'index de la question.
 *
 * C'est le cœur de la correction du deuxième défaut. Une clé au seul id de
 * message faisait partager un même état à toutes les questions du lot.
 */
export function cleSelection(messageId: number, index: number): string {
  return `${messageId}:${index}`;
}

/**
 * Vrai quand chaque question a reçu au moins une réponse.
 *
 * Un lot sans question n'est jamais « complet » : il n'y a rien à envoyer, et
 * répondre « oui » ici ferait apparaître un bouton d'envoi sur un simple
 * message texte.
 */
export function reponsesCompletes(
  questions: readonly QuestionPosee[],
  selections: SelectionsParQuestion
): boolean {
  if (!questions.length) return false;
  return questions.every((_, i) => (selections[i] ?? []).length > 0);
}

/** Nombre de questions déjà répondues — pour dire « 2 / 3 » à l'écran. */
export function nombreRepondu(
  questions: readonly QuestionPosee[],
  selections: SelectionsParQuestion
): number {
  return questions.reduce((n, _, i) => n + ((selections[i] ?? []).length > 0 ? 1 : 0), 0);
}

/**
 * Un lot part-il tout seul au premier clic ?
 *
 * Oui uniquement pour une question unique à choix unique : c'est le cas
 * rapide, et y ajouter un bouton « envoyer » serait un clic de plus pour rien.
 * Dès qu'il y a plusieurs questions, ou un choix multiple, on attend.
 */
export function envoiImmediat(questions: readonly QuestionPosee[]): boolean {
  return questions.length === 1 && !questions[0]?.multi;
}

/**
 * Met les réponses en une seule phrase pour l'orchestrateur.
 *
 * On répète la question devant sa réponse : le modèle reçoit le texte brut
 * d'un message, sans structure, et « sam. 17 oct, Plein air, airbnb » seul
 * l'obligerait à deviner quelle valeur répond à quoi — c'est précisément là
 * qu'il se trompe et qu'il repose la question.
 *
 * La question est écrite telle qu'elle a été posée, sans sa ponctuation
 * finale, pour que la ligne se lise naturellement.
 */
export function formatterReponses(
  questions: readonly QuestionPosee[],
  selections: SelectionsParQuestion
): string {
  return questions
    .map((q, i) => {
      const choix = selections[i] ?? [];
      if (!choix.length) return null;
      const libelle = q.q.trim().replace(/\s*[?:：]\s*$/, "");
      return libelle ? `${libelle} : ${choix.join(", ")}` : choix.join(", ");
    })
    .filter((l): l is string => l !== null)
    .join("\n");
}
