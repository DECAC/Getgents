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

export const SUGGESTIONS_PROMPT_INSTRUCTION =
  "Dès que tu poses une question fermée (l'utilisateur doit choisir parmi quelques options précises — arrêt, date, lieu, oui/non, etc.), tu DOIS terminer ta réponse (après le texte visible, sur sa propre ligne, jamais dans le corps du message) par un bloc : " +
  '<!--QUESTIONS: [{"q":"Intitulé exact de la question","options":["Option A","Option B","Option C"],"multi":false}]--> ' +
  "Règles impératives : (1) une entrée par question posée, dans l'ordre ; (2) 2 à 5 options courtes en français, reprenant les choix que tu viens d'énumérer (même libellés) ; (3) \"multi\": false par défaut (boutons radio) — \"multi\": true seulement si plusieurs choix simultanés ont du sens ; (4) ne liste PAS les options en puces ou tirets dans le texte visible quand tu émets ce bloc — résume le contexte en une phrase puis pose la question (ex. « Voici les arrêts trouvés à proximité. Quel arrêt choisissez-vous pour vous rendre à La Défense ? » + bloc avec les trois noms d'arrêt) ; l'interface affichera des boutons radio cliquables à partir du bloc. " +
  "Exemple : après avoir trouvé trois arrêts, termine par <!--QUESTIONS: [{\"q\":\"Quel arrêt choisissez-vous pour vous rendre à La Défense ?\",\"options\":[\"La Colline (192 m)\",\"Pont de Saint-Cloud - Rive Gauche (266 m)\",\"Parc de Saint-Cloud (276–365 m)\"],\"multi\":false}]-->. " +
  "N'ajoute ce bloc que si au moins une vraie question fermée a été posée.";

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
