/** Texte utile d'une réponse OpenRouter (content + éventuel raisonnement si content vide). */
export function extractLlmMessageText(data: {
  choices?: { message?: Record<string, unknown> }[];
}): string {
  const msg = data.choices?.[0]?.message;
  if (!msg) return "";

  const parts: string[] = [];
  if (typeof msg.content === "string" && msg.content.trim()) parts.push(msg.content);

  const details = msg.reasoning_details as { text?: string }[] | undefined;
  if (Array.isArray(details)) {
    const joined = details.map((d) => d.text ?? "").join("");
    if (joined.trim()) parts.push(joined);
  } else if (typeof msg.reasoning === "string" && msg.reasoning.trim()) {
    parts.push(msg.reasoning);
  }

  // Certains modèles (Kimi, R1…) placent tout le JSON dans reasoning ; d'autres
  // le répartissent — on concatène pour maximiser les chances d'extraire le bloc.
  return parts.join("\n").trim();
}
