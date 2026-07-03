import type { Espace, EspacesMap, Tool, UserFile } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";
import { formatConversationStartedAt, newConversationId } from "@/lib/conversationUtils";

// Pont client-only entre le Builder et le côté utilisateur : il n'y a pas de
// backend dans cette maquette, donc un gent publié n'est visible que dans le
// navigateur qui l'a publié (localStorage), pas partagé entre appareils.
const STORAGE_KEY = "getgents:published-gents";

export function readPublishedGents(): EspacesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EspacesMap) : {};
  } catch {
    return {};
  }
}

export function writePublishedGent(id: string, espace: Espace): void {
  if (typeof window === "undefined") return;
  try {
    const current = readPublishedGents();
    current[id] = espace;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage indisponible (navigation privée, quota dépassé…) : la
    // publication reste visible dans le builder mais pas côté utilisateur.
  }
}

export function draftToEspace(draft: GentDraft): Espace {
  const tools: Tool[] = draft.connectors.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    icon: c.icon,
    desc: c.desc,
    connectable: c.category === "compte_tiers",
    connected: c.category === "compte_tiers" ? false : c.connected,
  }));

  const files: UserFile[] = [
    ...draft.knowledgeFiles.map((f) => ({ id: f.id, name: f.name, size: f.size, date: "Base de connaissance" })),
    ...draft.knowledgeUrls.map((u) => ({ id: u.id, name: u.url, size: "URL de référence", date: "Base de connaissance" })),
  ];

  let systemPrompt = draft.systemPrompt.trim();

  if (draft.knowledgeFiles.length || draft.knowledgeUrls.length) {
    const refs = [
      ...draft.knowledgeFiles.map((f) => `- fichier : ${f.name}`),
      ...draft.knowledgeUrls.map((u) => `- url : ${u.url}`),
    ].join("\n");
    systemPrompt += `\n\nBase de connaissance déclarée par le créateur (références seulement — leur contenu n'est pas analysé automatiquement dans cette maquette) :\n${refs}`;
  }

  const enabledArtefacts = draft.artefactTemplates.filter((t) => t.enabled).map((t) => t.label);
  if (enabledArtefacts.length) {
    systemPrompt += `\n\nTypes d'artefacts que tu peux proposer de générer pour cet utilisateur : ${enabledArtefacts.join(", ")}.`;
  }

  const threadId = newConversationId();
  const chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? undefined;

  return {
    icon: draft.icon,
    name: draft.name,
    gent: draft.name,
    version: 1,
    status: "live",
    statusLabel: "Actif",
    sensitive: draft.connectors.some((c) => c.category === "compte_tiers"),
    metrics: [],
    integrations: draft.connectors.map((c) => ({ label: c.name, action: c.category !== "lecture" })),
    tools,
    tabs: [],
    map: null,
    memory: "",
    conversations: [{ id: threadId, startedAt: formatConversationStartedAt(), messages: [] }],
    activeConversationId: threadId,
    files,
    artefacts: [],
    systemPrompt,
    chatModelId,
  };
}
