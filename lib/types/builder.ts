import type { ConversationMessage, ToolCategory } from "@/lib/types";

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

export type ConnectorKind = "mcp" | "a2a";

export interface ConnectorCatalogEntry {
  id: string;
  name: string;
  kind: ConnectorKind;
  icon: string;
  category: ToolCategory;
  desc: string;
  endpointHint: string;
}

export interface GentConnector extends ConnectorCatalogEntry {
  connected: boolean;
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

export interface KnowledgeFile {
  id: string;
  name: string;
  size: string;
}

export interface KnowledgeUrl {
  id: string;
  url: string;
}

export interface GentDraft {
  id: string;
  name: string;
  icon: string;
  objective: string;
  systemPrompt: string;
  status: GentDraftStatus;
  updatedAt: string;
  modelAssignments: ModelAssignment[];
  connectors: GentConnector[];
  artefactTemplates: ArtefactTemplateConfig[];
  builderConversation: ConversationMessage[];
  knowledgeFiles: KnowledgeFile[];
  knowledgeUrls: KnowledgeUrl[];
}

export type GentDraftsMap = Record<string, GentDraft>;
