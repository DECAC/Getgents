// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--QUESTIONS: [{"q":"...","options":["...","..."],"multi":false}]-->
// quand la réponse pose une ou plusieurs questions fermées. On l'extrait
// avant affichage pour construire des puces cliquables numérotées.
const QUESTIONS_RE = /<!--QUESTIONS:\s*(\[[\s\S]*?\])\s*-->/;
// Repère un bloc tronqué (réponse coupée par max_tokens avant la balise fermante) :
// on masque au moins l'artefact brut même si on ne peut pas parser les questions.
const TRUNCATED_MARKER_RE = /<!--QUESTIONS:[\s\S]*$/;

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

export function extractQuestions(raw: string): { text: string; questions: QuestionBlock[] } {
  const match = raw.match(QUESTIONS_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
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
