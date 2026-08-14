/**
 * Budget de latence des tours de l'assistant builder.
 *
 * L'atelier est un lieu d'itération : le créateur écrit une phrase et doit
 * voir une première proposition arriver tout de suite, quitte à la corriger
 * au tour suivant. Or chaque tour partait avec DEUX sources de lenteur
 * cumulées, quel que soit le sujet :
 *
 * - `reasoning: { enabled: true }` — le modèle réfléchit longuement avant
 *   d'émettre le moindre caractère visible ;
 * - `plugins:[{id:"web"}]` — OpenRouter lance une recherche web AVANT la
 *   génération, sur tous les tours, même « donne-moi un nom pour ce gent ».
 *
 * On les rend donc conditionnelles au lieu de systématiques, et on borne
 * l'attente par un délai maximal au-delà duquel le tour est rejoué en mode
 * dégradé (modèle rapide, sans réflexion ni recherche).
 */

/**
 * Au-delà de ce délai SANS le moindre caractère visible, le tour est
 * abandonné et rejoué en mode dégradé.
 *
 * Volontairement en dessous des trente secondes promises au créateur : le
 * rejeu doit lui aussi tenir dans l'enveloppe. Mesuré bout en bout à 21,7 s
 * dans le pire cas (tour muet abandonné à 20 s, puis rejeu qui répond).
 */
export const BUILDER_FIRST_TOKEN_DEADLINE_MS = 20_000;

export type BuilderTurnKind = "cadrage" | "apercu" | "conversation";

export interface BuilderTurnBudget {
  /** Flux de raisonnement demandé au modèle. */
  reasoning: boolean;
  /** Recherche web avant génération (coûte plusieurs secondes fixes). */
  webSearch: boolean;
  maxTokens: number;
}

/**
 * La recherche web ne se justifie que si le créateur cherche quelque chose
 * de réel : un connecteur, une API, un jeu de données. Pour tout le reste —
 * nommer le gent, rédiger ses instructions, dessiner son application — le
 * modèle n'a besoin d'aucune source externe, et l'attendre est du temps
 * perdu pour rien.
 */
const WEB_SEARCH_HINTS =
  /\b(connecteur|connectors?|api\b|mcp\b|open ?data|dataset|jeux? de données|source de données|sources de données|data\.gouv|endpoint|https?:\/\/)/i;

export function needsWebSearch(userText: string): boolean {
  return WEB_SEARCH_HINTS.test(userText);
}

export interface BuilderTurnContext {
  /** Message envoyé au modèle — sert à décider de la recherche web. */
  userText: string;
  /**
   * Tout premier tour, celui qui transforme l'objectif en proposition.
   * C'est LE moment où la réactivité compte : jamais de recherche web ici,
   * même si l'objectif contient le mot « API ».
   */
  seedObjective?: boolean;
  /** Rejeu après dépassement du délai : on coupe tout ce qui peut l'être. */
  degraded?: boolean;
}

export function builderTurnBudget(
  kind: BuilderTurnKind,
  ctx: BuilderTurnContext
): BuilderTurnBudget {
  if (ctx.degraded) {
    return { reasoning: false, webSearch: false, maxTokens: 4_000 };
  }

  switch (kind) {
    case "cadrage":
      return { reasoning: false, webSearch: false, maxTokens: 1_200 };
    case "apercu":
      return { reasoning: false, webSearch: false, maxTokens: 6_000 };
    case "conversation":
      return {
        // La réflexion visible était payée sur TOUS les tours. Elle retardait
        // le premier caractère sans rien apporter à une tâche au format
        // contraint (une phrase + un bloc à émettre).
        reasoning: false,
        webSearch: !ctx.seedObjective && needsWebSearch(ctx.userText),
        maxTokens: 16_000,
      };
  }
}
