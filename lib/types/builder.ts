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
  | "gmail"
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
  /**
   * Texte extrait du document côté navigateur (kind "file"). Sans lui, le
   * gent ne connaît que le NOM du fichier — il ne peut ni le lire ni y
   * répondre, seulement en extrapoler le sujet depuis son titre.
   */
  text?: string;
  /** Vrai si l'extraction a dépassé la limite de caractères. */
  truncated?: boolean;
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
  /** Affiche un bouton de téléchargement du document côté lecteur. */
  fileDownloadEnabled?: boolean;
  /** Exige le formulaire (nom, prénom, e-mail, captcha) avant le PDF. */
  fileDownloadFormEnabled?: boolean;
  /** Formulaire jump pour lancer le gent dès la première saisie (optionnel). */
  jumpForm?: JumpForm;
  /** Routine planifiée (mission exécutée automatiquement côté serveur). */
  routine?: import("@/lib/types").Routine;
  /** Canal de diffusion de la note produite par la routine (WhatsApp…). */
  channel?: import("@/lib/types").NotificationChannel;
  /** Artefact figé « mini-app » défini par le créateur. */
  pinnedArtefact?: import("@/lib/types").PinnedArtefact;
  /** Type de gent « visionneuse » : document fixé par le créateur, lu en immersion. */
  visionneuse?: import("@/lib/types").VisionneuseConfig;
  /**
   * Application à blocs produite dans l'onglet Aperçu : copiée dans l'espace
   * à la Preview / publication, pour que l'utilisateur voie le nouveau rendu
   * et non l'ancien canevas d'artefacts.
   */
  appPreview?: import("@/lib/appPreview").AppPreviewSpec;
  /** Modules ajoutés/remplacés au dernier tour d'assistant — badge « nouveau ». */
  appPreviewFreshIds?: string[];
  /** Empreinte du contenu au moment de la dernière publication (voir builderSnapshot.ts). */
  publishedSnapshot?: string;
  /**
   * Mode « fais-moi confiance » persistant : l'assistant ne consulte plus le
   * créateur avant de générer (voir lib/cadrage.ts).
   *
   * Préférence d'ATELIER, pas de contenu : volontairement absente de
   * draftContentSnapshot, sinon un simple basculement marquerait le gent
   * « modifié depuis la publication » et rallumerait le bouton Diffuser.
   */
  autoPilot?: boolean;
  /**
   * Rôle décrit par le créateur sur l'accueil du studio, en attente d'être
   * rejoué dans l'assistant à l'ouverture du gent. Consommé une seule fois
   * (voir BuilderProvider), puis effacé — c'est ce qui permet de poursuivre
   * dans le builder l'échange commencé sur la page d'accueil.
   */
  pendingBuilderMessage?: string;
}

export type GentDraftsMap = Record<string, GentDraft>;
