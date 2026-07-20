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

/** Plafonds de tokens de sortie — analyses longues (tableaux, scoring, négociation…). */
export const CHAT_MAX_TOKENS = {
  espace: 12_288,
  builder: 8192,
} as const;

/** Phase affichée à l'utilisateur pendant le traitement d'une requête. */
export type ThinkingPhase =
  | "preparing"
  | "connecting"
  | "tool_running"
  | "thinking"
  | "writing";

export interface StatusEvent {
  phase: ThinkingPhase;
  label: string;
}

/** Libellé par défaut selon la phase. */
export function defaultStatusLabel(phase: ThinkingPhase, detail?: string): string {
  switch (phase) {
    case "preparing":
      return "Préparation de la réponse…";
    case "connecting":
      return "Connexion aux outils…";
    case "tool_running":
      return detail ? `Consultation : ${detail}…` : "Consultation d'une source de données…";
    case "thinking":
      return "Réflexion en cours…";
    case "writing":
      return "Rédaction de la réponse…";
  }
}

/** Formate un identifiant d'outil serveur en libellé lisible. */
export function humanToolCallLabel(call: string): string {
  if (call.startsWith("prim_stops_nearby")) return "transports à proximité (PRIM)";
  if (call.startsWith("prim_next_departures")) return "horaires de passage (PRIM)";
  if (call.startsWith("powens_accounts")) return "comptes bancaires (Powens)";
  if (call.startsWith("powens_transactions")) return "transactions bancaires (Powens)";
  if (call.startsWith("dataset_")) {
    const action = call.includes("__query") ? "jeu de données (filtres)" : "jeu de données (proximité)";
    return action;
  }
  if (call.startsWith("rest_")) return "API REST";
  const [, tool] = call.split("__");
  return tool?.replace(/_/g, " ") ?? call;
}

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
  onToolEvent?: (ev: ToolEvent) => void,
  onStatus?: (ev: StatusEvent) => void
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
  onStatus?.({ phase: "preparing", label: defaultStatusLabel("preparing") });

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
        if (json?.status_event && onStatus) {
          onStatus(json.status_event as StatusEvent);
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
          onStatus?.({ phase: "writing", label: defaultStatusLabel("writing") });
        }
        if (Array.isArray(reasoningDetails)) {
          for (const part of reasoningDetails) {
            if (typeof part?.text === "string") {
              fullReasoning += part.text;
              changed = true;
              if (!content) {
                onStatus?.({ phase: "thinking", label: defaultStatusLabel("thinking") });
              }
            }
          }
        } else if (typeof legacyReasoning === "string" && legacyReasoning) {
          fullReasoning += legacyReasoning;
          changed = true;
          if (!content) {
            onStatus?.({ phase: "thinking", label: defaultStatusLabel("thinking") });
          }
        }

        if (changed) onToken(full, fullReasoning);
      } catch {
        // ligne SSE incomplète/malformée — ignorée, le buffer la recomplètera
      }
    }
  }

  return { text: full, reasoning: fullReasoning, truncated };
}
