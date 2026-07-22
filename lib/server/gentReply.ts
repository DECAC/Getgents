// Réponse conversationnelle d'un gent côté serveur : donné un espace et un
// message utilisateur, appelle le LLM (profil injecté, garde-fous), renvoie la
// réponse et l'espace mis à jour (le fil de conversation reçoit le message
// utilisateur + la réponse). Utilisé par le webhook WhatsApp entrant — même
// « cerveau » que la conversation dans l'app, sur un autre canal.
import type { Espace, ConversationMessage } from "@/lib/types";
import { profileContextNote } from "@/lib/profileSignal";
import { renderMarkdown } from "@/lib/markdown";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

// Le canal messagerie ne rend pas de HTML : on garde les réponses courtes et
// en texte simple (pas d'artefacts ni de signaux ici).
const REPLY_MAX_TOKENS = 700;

export interface GentReplyResult {
  ok: boolean;
  /** Texte brut de la réponse (prêt pour WhatsApp). */
  reply: string;
  /** Espace avec le nouvel échange ajouté au fil actif. */
  espace: Espace;
}

/** Aplati un message de conversation en texte pour l'historique LLM. */
function toPlain(m: ConversationMessage): string {
  return (m.text ?? "").replace(/<[^>]+>/g, "").trim();
}

export async function replyAsGent(espace: Espace, userText: string): Promise<GentReplyResult> {
  const key = process.env.OPENROUTER_API_KEY;
  const t = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  const userMsg: ConversationMessage = { role: "user", text: `<p>${userText.replace(/</g, "&lt;")}</p>`, t };

  const withUser = (reply: string, ok: boolean): GentReplyResult => {
    const threadId = espace.activeConversationId;
    const agentMsg: ConversationMessage = { role: "agent", text: renderMarkdown(reply), t };
    const conversations = espace.conversations.map((c) =>
      c.id === threadId ? { ...c, messages: [...c.messages, userMsg, agentMsg] } : c
    );
    return { ok, reply, espace: { ...espace, conversations } };
  };

  if (!key) return withUser("Service indisponible (clé API absente côté serveur).", false);

  const profileNote = espace.profile ? `\n\n${profileContextNote(espace.profile)}` : "";
  const dateNote = `Date et heure : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: "short" })} (Paris).`;
  const systemPrompt =
    `${espace.systemPrompt?.trim() || `Tu es le gent « ${espace.name} » de Getgents.`}\n\n${dateNote}${profileNote}` +
    `\n\nCONTEXTE : tu réponds par messagerie (WhatsApp). Sois concis et direct, en texte simple (pas de markdown lourd, pas de tableau). ` +
    (espace.webSearch ? "Tu peux t'appuyer sur la recherche web ; cite brièvement tes sources." : "");

  // Historique récent du fil actif (borné) pour garder le contexte de l'échange.
  const thread = espace.conversations.find((c) => c.id === espace.activeConversationId);
  const history = (thread?.messages ?? [])
    .filter((m) => m.role === "agent" || m.role === "user")
    .slice(-10)
    .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: toPlain(m) }));

  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: espace.chatModelId ?? "anthropic/claude-sonnet-5",
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userText }],
        max_tokens: REPLY_MAX_TOKENS,
        ...(espace.webSearch ? { plugins: [{ id: "web" }] } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) return withUser("Désolé, je n'ai pas pu traiter votre message pour le moment.", false);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim() || "Je n'ai pas de réponse à formuler.";
    return withUser(reply, true);
  } catch {
    return withUser("Service momentanément indisponible, réessayez plus tard.", false);
  }
}
