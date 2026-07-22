import type { ConversationMessage, RestApiToolConfig, JumpForm } from "@/lib/types";

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
  | "dataset"
  | "prim"
  | "powens"
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
  /** Configuration complète pour un connecteur « API REST » (toolKind === "api-rest"). */
  restConfig?: RestApiToolConfig;
}

export type KnowledgeSourceKind = "file" | "url" | "text";

export interface KnowledgeSource {
  id: string;
  kind: KnowledgeSourceKind;
  label: string;
  meta: string;
}

export type ArtefactKind = "report" | "checklist" | "visual" | "timeline" | "budget" | "map";

/**
 * Exemple illustratif d'un type d'artefact que le gent peut générer.
 * Ce n'est plus une config activable/désactivable par gent : tous les types
 * sont éligibles pour tous les gents, le modèle décide seul quand en
 * proposer un — voir ARTEFACT_PROMPT_INSTRUCTION (lib/artefactSignal.ts).
 */
export interface ArtefactExample {
  id: string;
  label: string;
  kind: ArtefactKind;
  description: string;
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
  builderConversation: ConversationMessage[];
  /** Autorise le gent publié à faire des recherches web (plugin OpenRouter). */
  webSearch?: boolean;
  /** Formulaire jump pour lancer le gent dès la première saisie (optionnel). */
  jumpForm?: JumpForm;
  /** Routine planifiée (mission exécutée automatiquement côté serveur). */
  routine?: import("@/lib/types").Routine;
  /** Canal de diffusion de la note produite par la routine (WhatsApp…). */
  channel?: import("@/lib/types").NotificationChannel;
  /** Empreinte du contenu au moment de la dernière publication (voir builderSnapshot.ts). */
  publishedSnapshot?: string;
}

export type GentDraftsMap = Record<string, GentDraft>;
