export type EspaceStatus = "live" | "paused" | "done";

export type ToolCategory = "lecture" | "ecriture" | "compte_tiers";

export interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  icon: string;
  desc: string;
  connectable: boolean;
  connected?: boolean;
}

export interface TimelineStep {
  day: number;
  city: string;
  night: string;
  status: "done" | "future";
  tags: string[];
}

export interface ReservationItem {
  id: string;
  icon: string;
  service: string;
  category: ToolCategory;
  what: string;
  rows: [string, string][];
  price: string | null;
  status: "pending" | "sent" | "confirmed" | "cancelled";
}

export interface BudgetCategory {
  label: string;
  color: string;
  spent: number;
}

export interface BudgetHistoryPoint {
  day: string;
  cum: number;
}

export type TabKind = "timeline" | "resv" | "chart";

export interface EspaceTab {
  id: string;
  name: string;
  kind: TabKind;
  sub: string;
  steps?: TimelineStep[];
  items?: ReservationItem[];
  envelope?: number;
  categories?: BudgetCategory[];
  history?: BudgetHistoryPoint[];
}

export interface MapStop {
  day: number;
  city: string;
  night: string;
  x: number;
  y: number;
}

export interface EspaceMap {
  title: string;
  hint: string;
  stops: MapStop[];
}

export type ConversationRole =
  | "agent"
  | "user"
  | "tool"
  | "artef-visual"
  | "artef-pointer"
  | "artef-new"
  | "artef-proposal"
  | "theme-proposal"
  | "geo-request"
  | "connector-proposal"
  | "config-proposal";

export interface ConversationThread {
  id: string;
  startedAt: string;
  messages: ConversationMessage[];
}

export interface MapPoint {
  label: string;
  lat: number;
  lon: number;
}

export interface ArtefactProposal {
  kind: "report" | "checklist" | "chart" | "visual" | "map";
  title: string;
  body?: string;
  items?: string[];
  chartData?: { label: string; value: number }[];
  mapPoints?: MapPoint[];
}

/**
 * Onglet thématique regroupant un ou plusieurs modules du canvas (onglets
 * structurels, carte, artefacts) — voir ModuleCanvas.tsx pour la convention
 * d'id des modules (`tab-<id>`, `map`, `artef-<id>`). Un module n'appartient
 * qu'à un seul onglet thématique à la fois.
 */
export interface ThemeTab {
  id: string;
  label: string;
  moduleIds: string[];
}

/** Action proposée par l'assistant sur les onglets thématiques, à valider par l'utilisateur. */
export type ThemeTabProposalAction =
  | { action: "create"; label: string; moduleIds: string[] }
  | { action: "rename"; tabId: string; label: string }
  | { action: "delete"; tabId: string };

export interface ConversationMessage {
  id?: string;
  role: ConversationRole;
  text?: string;
  t?: string;
  kind?: string;
  what?: string;
  ok?: boolean;
  /** Détail du résultat d'un appel d'outil en échec (diagnostic). */
  toolDetail?: string;
  ref?: string;
  tab?: string;
  icon?: string;
  status?: "pending" | "sent";
  title?: string;
  link?: string;
  questions?: { q: string; options: string[]; multi?: boolean }[];
  proposal?: ArtefactProposal;
  proposalStatus?: "pending" | "added" | "dismissed";
  themeProposal?: ThemeTabProposalAction;
  themeProposalStatus?: "pending" | "applied" | "dismissed";
  /** Demande de partage de position émise par le gent, à valider par l'utilisateur. */
  geoRequestStatus?: "pending" | "granted" | "denied" | "error";
  /** Connecteur préparé par l'assistant du builder, à valider par le créateur. */
  connectorProposal?: { kind: "dataset" | "mcp"; name: string; url: string };
  connectorProposalStatus?: "pending" | "added" | "dismissed";
  /** Connecteurs candidats découverts par recherche web, à sélectionner par le créateur. */
  connectorSuggestions?: {
    kind: "dataset" | "mcp" | "api-rest";
    name: string;
    url: string;
    description: string;
    security: string;
    stability: string;
  }[];
  connectorSuggestionsStatus?: "pending" | "applied" | "dismissed";
  /** Configuration complète du gent proposée par l'assistant du builder. */
  configProposal?: {
    name?: string;
    objective?: string;
    systemPrompt?: string;
    webSearch?: boolean;
    chatModelId?: string;
    reasoningModelId?: string;
    connectors?: { kind: "dataset" | "mcp" | "api-rest" | "prim" | "powens"; name: string; url: string }[];
  };
  configProposalStatus?: "pending" | "applied" | "dismissed";
  reasoning?: string;
}

export interface UserFile {
  id: string;
  name: string;
  size: string;
  date: string;
}

export interface Artefact {
  id: string;
  title: string;
  type: string;
  icon: string;
  date: string;
  visual?: boolean;
  body?: string;
  chartData?: { label: string; value: number }[];
  checklistItems?: { label: string; checked: boolean }[];
  /** Points géolocalisés pour les artefacts carte (fond IGN cartes.gouv.fr). */
  mapPoints?: MapPoint[];
}

export interface EspaceMetric {
  value: string;
  suffix?: string;
  label: string;
  warn?: boolean;
}

export type RestApiMethod = "GET" | "POST";

/** Paire clé/valeur fixe (paramètre de requête ou en-tête). */
export interface RestApiKeyValue {
  name: string;
  value: string;
}

/** Paramètre rempli par le modèle au moment de l'appel (ex. departure_id). */
export interface RestApiModelParam {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

export interface RestApiAuth {
  mode: "none" | "api-key";
  placement: "header" | "query";
  /** Nom de l'en-tête (ex. X-API-Key) ou du paramètre (ex. api_key). */
  fieldName: string;
  /**
   * Valeur de la clé. Littérale (stockée dans le navigateur pour cette maquette)
   * ou référence à une variable d'environnement serveur : `env:NOM` ou `${NOM}`.
   */
  value: string;
}

/**
 * Configuration complète d'un connecteur « API REST » saisie à la main dans le
 * builder. Elle permet d'appeler n'importe quelle API (ex. SerpApi Google
 * Flights) : URL de base, méthode, paramètres fixes, clé API et paramètres que
 * le modèle renseigne dynamiquement à chaque appel.
 */
export interface RestApiToolConfig {
  method: RestApiMethod;
  baseUrl: string;
  /** Décrit à quoi sert l'outil et quand l'appeler — exposé au modèle. */
  description: string;
  queryParams: RestApiKeyValue[];
  headers: RestApiKeyValue[];
  auth: RestApiAuth;
  modelParams: RestApiModelParam[];
  /** Indice facultatif sur la façon d'exploiter la réponse JSON. */
  responseHint?: string;
}

/** Un connecteur API REST prêt à l'emploi côté espace (nom + config). */
export interface RestApiConnector {
  name: string;
  config: RestApiToolConfig;
}

export interface Espace {
  icon: string;
  name: string;
  gent: string;
  version: number;
  status: EspaceStatus;
  statusLabel: string;
  sensitive: boolean;
  metrics: EspaceMetric[];
  integrations: { label: string; action: boolean }[];
  tools: Tool[];
  tabs: EspaceTab[];
  map: EspaceMap | null;
  memory: string;
  conversations: ConversationThread[];
  activeConversationId: string;
  files: UserFile[];
  artefacts: Artefact[];
  /** Onglets thématiques regroupant des modules du canvas — optionnel, défaut [] à la lecture. */
  themeTabs?: ThemeTab[];
  systemPrompt?: string;
  chatModelId?: string;
  /** Serveurs MCP (transport Streamable HTTP) configurés dans le builder. */
  mcpServers?: { name: string; url: string }[];
  /** Datasets open data (portails Opendatasoft) interrogeables par proximité. */
  datasets?: { name: string; url: string }[];
  /** Connecteur IDFM PRIM actif (transports IDF, clé API côté serveur). */
  prim?: boolean;
  /** Connecteur Powens actif (agrégation bancaire sandbox, secrets côté serveur). */
  powens?: boolean;
  /** Connecteurs API REST personnalisés configurés à la main dans le builder. */
  restApis?: RestApiConnector[];
  /** Recherche web activée pour ce gent (plugin web OpenRouter). */
  webSearch?: boolean;
}

export type EspacesMap = Record<string, Espace>;
