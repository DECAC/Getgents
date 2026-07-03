export interface ChatMessage {
  role: string;
  content: string;
}

// Appelle /api/chat en streaming et notifie onToken avec le texte accumulé à
// chaque fragment reçu, pour un affichage progressif façon LLM (au lieu
// d'attendre la réponse complète avant de l'afficher).
export async function streamChatCompletion(
  payload: { model: string; messages: ChatMessage[]; max_tokens?: number },
  onToken: (fullTextSoFar: string) => void
): Promise<string> {
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
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken(full);
        }
      } catch {
        // ligne SSE incomplète/malformée — ignorée, le buffer la recomplètera
      }
    }
  }

  return full;
}
