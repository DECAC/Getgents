import type { Espace } from "@/lib/types";
import {
  STARTER_PROMPT_INSTRUCTION,
  describeGentForStarters,
  parseStarters,
  STARTER_COUNT,
} from "@/lib/starterSignal";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

/**
 * Produit les déclencheurs d'un gent conversationnel à partir de sa seule
 * configuration. Ni recherche web ni outils : on décrit des capacités, on ne
 * répond pas à une vraie question.
 *
 * Renvoie une liste vide plutôt que de lever : l'appelant retombe alors sur un
 * espace sans déclencheurs, ce qui reste parfaitement utilisable.
 */
export async function generateStarters(espace: Espace): Promise<string[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  if (espace.pinnedArtefact?.enabled) return [];

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://getgents.app",
        "X-Title": "Getgents",
      },
      body: JSON.stringify({
        model: espace.chatModelId || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Tu conçois l'accueil d'un assistant conversationnel. À partir de la configuration " +
              "ci-dessous, tu proposes des questions d'amorce qui donnent à voir ce qu'il sait faire.\n\n" +
              describeGentForStarters(espace),
          },
          { role: "user", content: STARTER_PROMPT_INSTRUCTION },
        ],
        max_tokens: 700,
        // Le raisonnement consommerait le budget de tokens sans bénéfice ici :
        // la tâche est courte et entièrement contrainte par le format demandé.
        reasoning: { effort: "low" },
      }),
    });
  } catch {
    return [];
  }

  if (!upstream.ok) return [];

  const data = await upstream.json().catch(() => null);
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const starters = parseStarters(content);
  // Un rang incomplet se remarque plus qu'une absence : on préfère ne rien
  // afficher que quatre bulles bancales.
  return starters.length === STARTER_COUNT ? starters : [];
}
