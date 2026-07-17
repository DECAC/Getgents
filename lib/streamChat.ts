import type { RestApiConnector } from "@/lib/types";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamChatResult {
  text: string;
  reasoning: string;
  /** Vrai si le modèle a atteint max_tokens avant de terminer sa réponse (finish_reason=length). */
  truncated: boolean;
}

/** Plafonds de tokens de sortie — le builder produit des réponses longues (prompt, connecteurs, bloc GENT_CONFIG). */
export const CHAT_MAX_TOKENS = {
  espace: 4096,
  builder: 8192,
} as const;

/** Événement émis par la route quand le gent utilise un outil MCP. */
export interface ToolEvent {
  status: "connected" | "connect_error" | "running" | "done";
  server?: string;
  toolCount?: number;
  call?: string;
  args?: Record<string, unknown>;
  ok?: boolean;
  /** Extrait du résultat en cas d'échec (diagnostic visible dans chat/audit/rapport). */
  detail?: string;
  message?: string;
}

// Appelle /api/chat en streaming et notifie onToken avec le texte accumulé à
// chaque fragment reçu, pour un affichage progressif façon LLM (au lieu
// d'attendre la réponse complète avant de l'afficher). Le flux de raisonnement
// (modèles "thinking" supportés par OpenRouter) est accumulé séparément et
// notifié via onToken en second argument — vide si le modèle n'en fournit pas.
// Si mcpServers est fourni, la route exécute une boucle d'outils MCP et
// signale chaque appel via onToolEvent.
export async function streamChatCompletion(
  payload: {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    reasoning?: { enabled?: boolean };
    mcpServers?: { name: string; url: string }[];
    datasets?: { name: string; url: string }[];
    prim?: boolean;
    powens?: boolean;
    restApis?: RestApiConnector[];
    webSearch?: boolean;
  },
  onToken: (fullTextSoFar: string, fullReasoningSoFar: string) => void,
  onToolEvent?: (ev: ToolEvent) => void
): Promise<StreamChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    const err = data?.error;
    const message =
      typeof err === "string"
        ? err
        : typeof err?.message === "string"
          ? err.message
          : `Erreur API (${res.status})`;
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let fullReasoning = "";
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === "[DONE]") continue;
      try {
        const json = JSON.parse(dataStr);
        if (json?.tool_event && onToolEvent) {
          onToolEvent(json.tool_event as ToolEvent);
          continue;
        }
        if (json?.choices?.[0]?.finish_reason === "length") truncated = true;
        const delta = json?.choices?.[0]?.delta;
        const content: string | undefined = delta?.content;
        const reasoningDetails: { type?: string; text?: string }[] | undefined = delta?.reasoning_details;
        const legacyReasoning: string | undefined = delta?.reasoning;

        let changed = false;
        if (content) {
          full += content;
          changed = true;
        }
        if (Array.isArray(reasoningDetails)) {
          for (const part of reasoningDetails) {
            if (typeof part?.text === "string") {
              fullReasoning += part.text;
              changed = true;
            }
          }
        } else if (typeof legacyReasoning === "string" && legacyReasoning) {
          fullReasoning += legacyReasoning;
          changed = true;
        }

        if (changed) onToken(full, fullReasoning);
      } catch {
        // ligne SSE incomplète/malformée — ignorée, le buffer la recomplètera
      }
    }
  }

  return { text: full, reasoning: fullReasoning, truncated };
}
