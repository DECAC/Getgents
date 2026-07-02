// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--SUGGESTIONS: ["Réponse 1", "Réponse 2"]--> quand des réponses rapides
// ont du sens (question fermée, choix multiple). On l'extrait avant affichage.
const SUGGESTIONS_RE = /<!--SUGGESTIONS:\s*(\[[\s\S]*?\])\s*-->/;

export const SUGGESTIONS_PROMPT_INSTRUCTION =
  "Quand ta réponse pose une question à laquelle l'utilisateur pourrait répondre par un choix parmi quelques options courtes, termine ta réponse (après le texte visible, sur sa propre ligne) par : <!--SUGGESTIONS: [\"Option 1\", \"Option 2\", \"Option 3\"]--> avec 2 à 4 options maximum, en français, formulées comme des réponses que l'utilisateur pourrait cliquer. N'ajoute ce bloc que si des suggestions ont vraiment du sens ; sinon ne l'ajoute pas.";

export function extractSuggestions(raw: string): { text: string; suggestions: string[] } {
  const match = raw.match(SUGGESTIONS_RE);
  if (!match) return { text: raw, suggestions: [] };

  let suggestions: string[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      suggestions = parsed.filter((s): s is string => typeof s === "string").slice(0, 4);
    }
  } catch {
    // ignore malformed block
  }

  const text = raw.slice(0, match.index).trim();
  return { text, suggestions };
}
