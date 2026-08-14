/**
 * Format des appels d'outils renvoyés à OpenRouter / Azure.
 *
 * GPT-4.1 via Azure (Responses API derrière OpenRouter) refuse le suivi d'un
 * outil si le `call_id` du résultat ne correspond pas à un appel dans
 * l'historique — d'où l'erreur « No tool call found for function call output ».
 * Causes fréquentes : `type: "function"` manquant, plugin web mélangé aux
 * résultats d'outils, ou identifiants de streaming mal reconstitués.
 */

export type StreamedToolCall = {
  id?: string;
  type?: string;
  function: { name?: string; arguments: string };
};

export type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolCallDelta = {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
};

/** Accumule les fragments SSE `delta.tool_calls` (index, id, nom, arguments). */
export function applyToolCallDelta(acc: StreamedToolCall[], deltas: ToolCallDelta[]): void {
  for (const tc of deltas) {
    const index = typeof tc.index === "number" && tc.index >= 0 ? tc.index : 0;
    const slot = (acc[index] ??= { function: { arguments: "" } });
    if (tc.id) slot.id = tc.id;
    if (tc.type) slot.type = tc.type;
    if (tc.function?.name) slot.function.name = (slot.function.name ?? "") + tc.function.name;
    if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
  }
}

/** Appels complets au format Chat Completions (type function obligatoire). */
export function toOpenAIToolCalls(acc: StreamedToolCall[]): OpenAIToolCall[] {
  return acc
    .filter((tc): tc is StreamedToolCall & { id: string; function: { name: string; arguments: string } } =>
      Boolean(tc.id && tc.function.name)
    )
    .map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments?.trim() ? tc.function.arguments : "{}",
      },
    }));
}

export function historyHasToolResults(messages: Record<string, unknown>[]): boolean {
  return messages.some((m) => m.role === "tool");
}

/**
 * Azure + plugin web OpenRouter + résultats d'outils dans le même tour :
 * le fournisseur mélange ses propres call_id (recherche web) avec les nôtres.
 * On coupe le plugin dès qu'un résultat d'outil est déjà dans l'historique.
 */
export function shouldAttachWebPlugin(webSearch: boolean | undefined, messages: Record<string, unknown>[]): boolean {
  return Boolean(webSearch) && !historyHasToolResults(messages);
}

export function isOrphanToolCallOutputError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("no tool call found for function call output") ||
    t.includes("no tool output found for function call")
  );
}

/** Message utilisateur de secours : le modèle lit les résultats sans protocole d'outils. */
export function flattenToolRoundForRetry(
  toolCalls: { function: { name: string } }[],
  results: string[]
): string {
  const blocks = toolCalls.map((tc, i) => `### ${tc.function.name}\n${results[i] ?? ""}`);
  return (
    "Les outils suivants ont déjà été exécutés. Voici leurs résultats. " +
    "Réponds à l'utilisateur à partir de ces données, sans rappeler ces outils.\n\n" +
    blocks.join("\n\n")
  );
}

/** Texte affiché à l'utilisateur si le filet de sécurité échoue aussi. */
export function userFacingToolLoopError(errText: string): string {
  if (isOrphanToolCallOutputError(errText)) {
    return "L'assistant a bien interrogé tes outils, mais le modèle n'a pas pu lire le résultat. Réessaie ta question.";
  }
  return `Erreur API : ${errText}`;
}
