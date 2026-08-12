// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--QUESTIONS: [{"q":"...","options":["...","..."],"multi":false}]-->
// quand la réponse pose une ou plusieurs questions fermées. On l'extrait
// avant affichage pour construire des puces cliquables numérotées.
//
// Relances conversationnelles (distinctes) :
// <!--FOLLOWUPS: ["Question libre 1 ?","Question libre 2 ?"]-->
const QUESTIONS_RE = /<!--QUESTIONS:\s*(\[[\s\S]*?\])\s*-->/;
const FOLLOWUPS_RE = /<!--FOLLOWUPS:\s*(\[[\s\S]*?\])\s*-->/;

export interface QuestionBlock {
  q: string;
  options: string[];
  multi?: boolean;
}

/** Ajoutée automatiquement par l'interface — ne pas demander au modèle de l'inclure. */
export const QUICK_REPLY_OTHER_LABEL = "Autre";

export const SUGGESTIONS_PROMPT_INSTRUCTION =
  "Dès que tu poses une question à l'utilisateur (choix à faire, confirmation, préférence, suite à donner), tu DOIS terminer ta réponse (après le texte visible, sur sa propre ligne, jamais dans le corps du message) par un bloc : " +
  '<!--QUESTIONS: [{"q":"Intitulé exact de la question","options":["Option A","Option B","Option C"],"multi":false}]--> ' +
  "Règles impératives : (1) SYSTÉMATIQUE — chaque question posée dans ta réponse exige ce bloc, sans exception ; (2) une entrée par question posée, dans l'ordre ; (3) 2 à 4 options courtes en français, contextualisées au fil (reprends les choix que tu viens d'évoquer) ; (4) \"multi\": false par défaut — \"multi\": true seulement si plusieurs choix simultanés ont du sens ; (5) ne liste PAS les options en puces ou tirets dans le texte visible — pose la question en une phrase puis laisse l'interface afficher les boutons ; (6) n'inclus PAS l'option « Autre » dans le JSON — l'interface l'ajoute automatiquement avec un champ libre. " +
  "Exemple : « Veux-tu que j'envoie cet e-mail ? » → <!--QUESTIONS: [{\"q\":\"Veux-tu que j'envoie cet e-mail ?\",\"options\":[\"Oui, envoie-le\",\"Non, prépare seulement un brouillon\"],\"multi\":false}]-->. " +
  "Si tu ne poses aucune question, n'émet pas de bloc QUESTIONS.";

/**
 * Relances pour poursuivre l'échange — régulièrement, pas à chaque message.
 * Affichées en puces : un clic envoie la question telle quelle.
 */
export const FOLLOWUPS_PROMPT_INSTRUCTION =
  "Pour inciter l'utilisateur à poursuivre la conversation, propose RÉGULIÈREMENT (environ une réponse sur deux ou trois quand tu as livré une info utile, un conseil ou un récap) " +
  "2 ou 3 questions de suite pertinentes, formulées comme l'utilisateur les poserait. " +
  "Termine alors ta réponse (après le texte visible et après un éventuel bloc QUESTIONS, sur sa propre ligne) par exactement : " +
  '<!--FOLLOWUPS: ["Question libre 1 ?","Question libre 2 ?","Question libre 3 ?"]--> ' +
  "Règles : (1) questions courtes en français, concrètes, liées au fil en cours ; (2) 2 ou 3 max ; (3) PAS à chaque réponse — saute les messages purement procéduraux " +
  "(simple accusé, demande d'une seule info manquante, oui/non, ou quand tu viens déjà d'émettre un bloc QUESTIONS fermées) ; " +
  "(4) ne liste PAS ces relances dans le texte visible — l'interface les affichera en boutons ; " +
  "(5) n'émets jamais plus d'un bloc FOLLOWUPS par réponse.";

export function extractQuestions(raw: string): { text: string; questions: QuestionBlock[] } {
  const match = raw.match(QUESTIONS_RE);
  if (!match) {
    const truncated = raw.match(/<!--QUESTIONS:[\s\S]*$/);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), questions: [] };
    return { text: raw, questions: [] };
  }

  let questions: QuestionBlock[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      questions = parsed
        .filter(
          (item): item is QuestionBlock =>
            item &&
            typeof item.q === "string" &&
            Array.isArray(item.options) &&
            item.options.every((o: unknown) => typeof o === "string")
        )
        .map((item) => ({ q: item.q, options: item.options.slice(0, 5), multi: !!item.multi }))
        .slice(0, 6);
    }
  } catch {
    // ignore malformed block
  }

  // On retire uniquement le bloc repéré : le texte avant ET après est conservé
  // (un bloc ARTEFACT peut suivre le bloc QUESTIONS dans la même réponse).
  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return { text, questions };
}

export function extractFollowups(raw: string): { text: string; followups: string[] } {
  const match = raw.match(FOLLOWUPS_RE);
  if (!match) {
    const truncated = raw.match(/<!--FOLLOWUPS:[\s\S]*$/);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), followups: [] };
    return { text: raw, followups: [] };
  }

  let followups: string[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      followups = parsed
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 160))
        .slice(0, 3);
    }
  } catch {
    // ignore malformed block
  }

  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return { text, followups };
}
