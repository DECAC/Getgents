import type { ConversationThread } from "@/lib/types";

export function stripMessageHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function threadPreview(thread: ConversationThread): string {
  const firstUser = thread.messages.find((m) => m.role === "user");
  if (firstUser?.text) return stripMessageHtml(firstUser.text).slice(0, 100);
  return "Nouvel échange";
}

export function threadLastActivity(thread: ConversationThread): string {
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const m = thread.messages[i];
    if ((m.role === "user" || m.role === "agent") && m.t) return m.t;
  }
  return thread.startedAt;
}

export function getActiveConversation(threads: ConversationThread[] | undefined, activeId: string): ConversationThread {
  if (!threads?.length) return { id: "empty", startedAt: "", messages: [] };
  return threads.find((t) => t.id === activeId) ?? threads[0];
}

export function newConversationId(): string {
  return `conv-${Date.now()}`;
}

export function formatConversationStartedAt(): string {
  return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
