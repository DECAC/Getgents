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

  const enabledArtefacts = draft.artefactTemplates.filter((t) => t.enabled);
  if (enabledArtefacts.length) {
    const labels = enabledArtefacts.map((t) => t.label).join(", ");
    systemPrompt +=
      `\n\nTypes d'artefacts activés pour cet espace : ${labels}. ` +
      "À chaque réponse utile, propose activement l'un de ces formats via le bloc ARTEFACT (checklist pour les étapes, rapport pour les textes et modèles, graphique pour les chiffres). " +
      "L'utilisateur décide s'il l'ajoute à son espace — ton rôle est de le proposer souvent, pas d'attendre qu'il le demande.";
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
  };
}
