import type { Espace, EspacesMap, Tool, UserFile } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
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

/** Met à jour le nom affiché côté utilisateur sans effacer conversations ni artefacts. */
export function patchPublishedGentName(id: string, name: string): void {
  if (typeof window === "undefined") return;
  const existing = readPublishedGents()[id];
  if (!existing) return;
  writePublishedGent(id, { ...existing, name, gent: name });
}

export function draftToEspace(draft: GentDraft): Espace {
  // Le modèle d'outils du builder (8 types génériques configurables : MCP,
  // API REST, connecteur personnalisé…) ne porte plus de catégorie
  // lecture / écriture / compte-tiers — on les affiche par défaut en lecture
  // seule côté espace ; aucun de ces types génériques ne déclenche
  // l'invariant de connexion réservé aux comptes tiers.
  const tools: Tool[] = draft.connectors.map((c) => {
    const type = CONNECTOR_TOOL_TYPES.find((t) => t.kind === c.toolKind);
    return {
      id: c.id,
      name: c.name,
      category: "lecture",
      icon: type?.icon ?? "🔌",
      desc: c.detail || type?.description || "",
      connectable: false,
      connected: true,
    };
  });

  const files: UserFile[] = draft.knowledgeSources.map((s) => ({
    id: s.id,
    name: s.label,
    size: s.meta,
    date: "Base de connaissance",
  }));

  let systemPrompt = draft.systemPrompt.trim();

  if (draft.knowledgeSources.length) {
    const refs = draft.knowledgeSources.map((s) => `- ${s.kind} : ${s.label}`).join("\n");
    systemPrompt += `\n\nBase de connaissance déclarée par le créateur (références seulement — leur contenu n'est pas analysé automatiquement dans cette maquette) :\n${refs}`;
  }

  // Tous les artefacts (rapport, checklist, graphique, aperçu visuel, carte) sont éligibles
  // pour tous les gents — pas de configuration côté créateur. Le modèle décide seul, au fil de
  // la conversation, quand un artefact concret apporte de la valeur (voir ARTEFACT_PROMPT_INSTRUCTION,
  // toujours injectée côté chat dans EspaceContext).
  systemPrompt +=
    "\n\nGénère des artefacts (rapport, checklist, graphique, aperçu visuel, carte) automatiquement et intelligemment, uniquement quand le contenu de la conversation s'y prête — n'attends jamais qu'on te le demande explicitement, et ne les propose pas non plus systématiquement hors de propos. " +
    "L'utilisateur décide s'il ajoute chaque proposition à son espace de travail.";

  const threadId = newConversationId();
  const chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? undefined;

  // Les connecteurs MCP dont le détail est une URL deviennent de vrais
  // serveurs d'outils côté chat (transport Streamable HTTP, ex. datagouv).
  const mcpServers = draft.connectors
    .filter((c) => c.toolKind === "mcp" && typeof c.detail === "string" && /^https?:\/\//.test(c.detail))
    .map((c) => ({ name: c.name, url: c.detail as string }));

  if (draft.webSearch) {
    systemPrompt +=
      "\n\nLa recherche web est activée pour cet espace : tes réponses peuvent s'appuyer sur des résultats web récents. Cite tes sources quand tu utilises une information issue du web.";
  }

  if (mcpServers.length) {
    systemPrompt +=
      `\n\nTu disposes d'outils temps réel via ${mcpServers.length > 1 ? "les serveurs MCP" : "le serveur MCP"} ${mcpServers.map((s) => s.name).join(", ")}. ` +
      "Utilise-les dès que la question porte sur des données qu'ils couvrent, plutôt que de répondre de mémoire, et cite la source des données obtenues.";
  }

  return {
    icon: draft.icon,
    name: draft.name,
    gent: draft.name,
    version: 1,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: draft.connectors.map((c) => ({ label: c.name, action: false })),
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
    mcpServers: mcpServers.length ? mcpServers : undefined,
    webSearch: draft.webSearch || undefined,
  };
}
