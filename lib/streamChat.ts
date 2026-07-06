export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamChatResult {
  text: string;
  reasoning: string;
}

// Appelle /api/chat en streaming et notifie onToken avec le texte accumulé à
// chaque fragment reçu, pour un affichage progressif façon LLM (au lieu
// d'attendre la réponse complète avant de l'afficher). Le flux de raisonnement
// (modèles "thinking" supportés par OpenRouter) est accumulé séparément et
// notifié via onToken en second argument — vide si le modèle n'en fournit pas.
export async function streamChatCompletion(
  payload: { model: string; messages: ChatMessage[]; max_tokens?: number; reasoning?: { enabled?: boolean } },
  onToken: (fullTextSoFar: string, fullReasoningSoFar: string) => void
): Promise<StreamChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message ?? `Erreur API (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let fullReasoning = "";

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

  return { text: full, reasoning: fullReasoning };
}
