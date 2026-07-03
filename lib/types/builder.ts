import type { ConversationMessage } from "@/lib/types";

/**
 * Capacités de modèles disponibles via l'API unique OpenRouter.
 * Un gent peut combiner plusieurs modèles, un par capacité, selon ses besoins.
 */
export type ModelCapability = "chat" | "reasoning" | "image" | "tts" | "stt";

export interface OpenRouterModel {
  id: string;
  label: string;
  provider: string;
  capability: ModelCapability;
  contextWindow?: number;
  pricing: { input: number; output: number }; // $ / 1M tokens (mock)
  tagline: string;
}

export interface ModelAssignment {
  capability: ModelCapability;
  modelId: string | null;
}

/**
 * Types d'outils qu'un gent peut utiliser. Il ne s'agit pas d'une liste de
 * services déjà prêts à l'emploi : chaque type est un modèle de
 * configuration que le créateur du gent personnalise (nom, description,
 * points de terminaison…).
 */
export type ConnectorToolKind =
  | "connecteur"
  | "connecteur-predefini"
  | "connecteur-personnalise"
  | "flux-assistant"
  | "invite"
  | "api-rest"
  | "mcp"
  | "ordinateur";

export interface ConnectorToolType {
  kind: ConnectorToolKind;
  name: string;
  icon: string;
  description: string;
}

/** Un outil concret configuré pour un gent, à partir d'un des types ci-dessus. */
export interface GentToolInstance {
  id: string;
  toolKind: ConnectorToolKind;
  name: string;
  /** Résumé court de la configuration saisie (ex. URL du serveur MCP). */
  detail?: string;
}

export type KnowledgeSourceKind = "file" | "url" | "text";

export interface KnowledgeSource {
  id: string;
  kind: KnowledgeSourceKind;
  label: string;
  meta: string;
}

export type ArtefactKind = "report" | "checklist" | "visual" | "timeline" | "budget" | "map";

export interface ArtefactTemplateConfig {
  id: string;
  label: string;
  kind: ArtefactKind;
  description: string;
  enabled: boolean;
}

export type GentDraftStatus = "draft" | "review" | "published";

export interface GentDraft {
  id: string;
  name: string;
  icon: string;
  objective: string;
  systemPrompt: string;
  status: GentDraftStatus;
  updatedAt: string;
  modelAssignments: ModelAssignment[];
  knowledgeSources: KnowledgeSource[];
  connectors: GentToolInstance[];
  artefactTemplates: ArtefactTemplateConfig[];
  builderConversation: ConversationMessage[];
}

export type GentDraftsMap = Record<string, GentDraft>;
