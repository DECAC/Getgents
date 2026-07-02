// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--QUESTIONS: [{"q":"...","options":["...","..."],"multi":false}]-->
// quand la réponse pose une ou plusieurs questions fermées. On l'extrait
// avant affichage pour construire des puces cliquables numérotées.
const QUESTIONS_RE = /<!--QUESTIONS:\s*(\[[\s\S]*?\])\s*-->/;

export interface QuestionBlock {
  q: string;
  options: string[];
  multi?: boolean;
}

export const SUGGESTIONS_PROMPT_INSTRUCTION =
  "Quand ta réponse pose une ou plusieurs questions fermées (l'utilisateur peut répondre en choisissant parmi quelques options courtes), termine ta réponse (après le texte visible, sur sa propre ligne) par un bloc : " +
  '<!--QUESTIONS: [{"q":"Intitulé de la question 1","options":["Option A","Option B","Option C"],"multi":false},{"q":"Intitulé de la question 2","options":["Option A","Option B"],"multi":true}]--> ' +
  "avec une entrée par question posée, dans l'ordre où tu les poses, 2 à 5 options courtes en français par question, et \"multi\": true seulement si plusieurs choix simultanés ont du sens pour cette question précise (sinon false). N'ajoute ce bloc que si au moins une vraie question fermée a été posée ; sinon ne l'ajoute pas.";

export function extractQuestions(raw: string): { text: string; questions: QuestionBlock[] } {
  const match = raw.match(QUESTIONS_RE);
  if (!match) return { text: raw, questions: [] };

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

  const text = raw.slice(0, match.index).trim();
  return { text, questions };
}
