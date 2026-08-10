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
  | "image-proposal"
  | "connector-proposal"
  | "config-proposal"
  | "jump-form-proposal"
  | "profile-proposal";

/**
 * « Formulaire jump » : un petit formulaire de champs affiché côté utilisateur
 * pour lancer le gent dès la première saisie, sans avoir à rédiger un prompt.
 * L'assistant du builder le propose quand le cas d'usage est assez précis
 * (ex. Assistant Vols → départ, arrivée, date).
 */
export type JumpFormFieldKind = "text" | "textarea" | "date" | "select";

export interface JumpFormField {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  kind: JumpFormFieldKind;
  /** Options pour un champ de type "select". */
  options?: string[];
}

export interface JumpForm {
  id: string;
  title: string;
  description?: string;
  submitLabel?: string;
  fields: JumpFormField[];
  /**
   * Gabarit du prompt envoyé au gent, avec des marqueurs {{id_du_champ}}
   * remplacés par les valeurs saisies. Si absent, un texte « Libellé : valeur »
   * est composé automatiquement.
   */
  promptTemplate?: string;
}

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
  kind: "report" | "checklist" | "chart" | "visual" | "map" | "dashboard" | "image";
  title: string;
  body?: string;
  items?: string[];
  chartData?: { label: string; value: number }[];
  mapPoints?: MapPoint[];
  /** Schéma de tableau de bord (rendu Recharts + cartes en plein espace). */
  dashboard?: import("@/lib/dashboardArtefact").DashboardSpec;
  /** Illustration (générée ou photo web) — renseignée après autorisation. */
  imageUrl?: string;
  imageCaption?: string;
  imageSource?: "generated" | "web";
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
  /** Relances conversationnelles (questions libres cliquables dans le fil). */
  followups?: string[];
  /** Image générée / affichée après autorisation (data URL ou https). */
  imageUrl?: string;
  imageStatus?: "pending" | "done" | "error";
  proposal?: ArtefactProposal;
  proposalStatus?: "pending" | "added" | "dismissed";
  themeProposal?: ThemeTabProposalAction;
  themeProposalStatus?: "pending" | "applied" | "dismissed";
  /** Illustration proposée (génération IA ou photo web) — jamais sans accord. */
  imageProposal?: import("@/lib/imageSignal").ImageProposal;
  imageProposalStatus?: "pending" | "generating" | "added" | "dismissed" | "error";
  /** Profil utilisateur proposé par le gent (onboarding/CV), à valider. */
  profileProposal?: import("@/lib/profileSignal").UserProfile;
  profileProposalStatus?: "pending" | "applied" | "dismissed";
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
    connectors?: {
      kind: "dataset" | "mcp" | "api-rest" | "prim" | "powens";
      name: string;
      url: string;
      restConfig?: RestApiToolConfig;
    }[];
  };
  configProposalStatus?: "pending" | "applied" | "dismissed";
  /** Formulaire jump proposé par l'assistant du builder, à valider par le créateur. */
  jumpFormProposal?: JumpForm;
  jumpFormProposalStatus?: "pending" | "applied" | "dismissed";
  reasoning?: string;
}

export interface UserFile {
  id: string;
  name: string;
  size: string;
  date: string;
  /**
   * Texte extrait du document côté navigateur (PDF, Word, texte, CSV). C'est
   * lui qui nourrit le contexte de la session — conversation comme artefact
   * figé. Absent pour les fichiers de démonstration, purement décoratifs.
   */
  text?: string;
  /** Vrai si l'extraction a dépassé la limite de caractères. */
  truncated?: boolean;
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
  /** Schéma de tableau de bord (rendu Recharts + cartes en plein espace). */
  dashboard?: import("@/lib/dashboardArtefact").DashboardSpec;
  /** Illustration générée ou photo web (data URL / https). */
  imageUrl?: string;
  imageCaption?: string;
  imageSource?: "generated" | "web";
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
  /** Modèle de génération d'image assigné (capability "image"), ex. google/nanobanana. */
  imageModelId?: string;
  /**
   * « Déclencheurs » : questions d'amorce affichées dans l'espace de travail
   * vierge, choisies par le gent lui-même d'après sa configuration (voir
   * lib/starterSignal.ts). Générées une fois, puis persistées.
   */
  starters?: string[];
  startersGeneratedAt?: string;
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
  /** Formulaire jump pour lancer le gent dès la première saisie (optionnel). */
  jumpForm?: JumpForm;
  /** Recherche web activée pour ce gent (plugin web OpenRouter). */
  webSearch?: boolean;
  /** Profil utilisateur validé (onboarding/CV) — réinjecté dans le prompt système. */
  profile?: import("@/lib/profileSignal").UserProfile;
  /** Routine planifiée (veille en tâche de fond) — exécutée côté serveur. */
  routine?: Routine;
  /** Artefact figé « mini-app » : un tableau de bord permanent que l'utilisateur rafraîchit d'un bouton. */
  pinnedArtefact?: PinnedArtefact;
  /** Canal de diffusion de la note produite par la routine (WhatsApp…). */
  channel?: NotificationChannel;
}

/**
 * Entrée attendue de l'utilisateur pour alimenter un artefact figé (ex. un lien
 * LinkedIn, un CV). Le créateur les déclare ; l'utilisateur les renseigne, et
 * elles nourrissent chaque génération/rafraîchissement de l'artefact.
 */
export interface PinnedArtefactInput {
  id: string;
  label: string;
  kind: "url" | "file" | "text";
  /** Valeur renseignée par l'utilisateur (URL, nom de fichier, texte court). */
  value?: string;
}

/**
 * Artefact figé « mini-app » : le créateur définit un tableau de bord permanent
 * dont seules les DONNÉES se rafraîchissent à la demande (bouton Update), sans
 * que l'utilisateur ait à reformuler quoi que ce soit. La mission décrit ce que
 * le gent doit produire ; le rendu reste un DashboardSpec, régénéré côté serveur.
 */
export interface PinnedArtefact {
  enabled: boolean;
  title: string;
  /** Instruction de génération du tableau de bord (le « prompt figé »). */
  mission: string;
  /** Entrées requises de l'utilisateur (LinkedIn, CV…). */
  inputs: PinnedArtefactInput[];
  /** Dernier rendu produit (null tant que non généré). */
  dashboard?: import("@/lib/dashboardArtefact").DashboardSpec;
  /** Horodatage ISO de la dernière génération. */
  generatedAt?: string;
  /**
   * Historique borné des générations (plus récente en tête) — alimente
   * l'onglet Audit et les rapports. Les ÉCHECS y figurent aussi : sans cela
   * une génération ratée ne laissait aucune trace exploitable.
   */
  runs?: PinnedRun[];
}

/** Trace d'une génération d'artefact figé, succès ou échec. */
export interface PinnedRun {
  at: string;
  ok: boolean;
  /** Diagnostic lisible (« ok — 6 blocs », « échec LLM 429 : … »). */
  note: string;
  /** Modèle réellement utilisé (peut différer du modèle chat après repli). */
  model?: string;
  /** Durée totale de la génération, tentatives comprises. */
  durationMs?: number;
  /** Nombre d'appels au modèle (2 en cas de repli). */
  attempts?: number;
  /** Statut HTTP du dernier appel en échec — distingue 401, 429, 500… */
  httpStatus?: number;
  /** Nombre de blocs du dashboard produit. */
  blocks?: number;
  /** Consommation de tokens rapportée par le fournisseur. */
  totalTokens?: number;
  /** Origine du déclenchement : espace du créateur, ou lien de partage. */
  source?: "espace" | "lien";
}

/**
 * Canal de diffusion externe : quand une routine produit une note, un résumé
 * court est livré ici (en plus de l'artefact dans l'espace). L'envoi effectif
 * se fait côté serveur avec des secrets d'environnement (jamais exposés au
 * navigateur) — voir lib/server/whatsapp.ts.
 */
export interface NotificationChannel {
  kind: "whatsapp" | "email";
  enabled: boolean;
  /** Destinataire : numéro E.164 (WhatsApp) ou adresse e-mail (email). */
  to: string;
  /** Horodatage ISO du consentement du destinataire (opt-in requis). */
  optInAt?: string;
  /**
   * WhatsApp uniquement : nom d'un template approuvé dans Meta, utilisé pour la
   * note quotidienne (envoi non sollicité, hors fenêtre de 24 h). Le template
   * doit avoir 2 variables de corps : {{1}} = titre, {{2}} = extrait. Sans
   * template, l'envoi sortant retombe sur du texte libre (best effort).
   */
  templateName?: string;
  /** Code langue du template (ex. « fr », « en_US »). Défaut : en_US. */
  templateLang?: string;
  /** Statut de la dernière livraison (posé par le runner). */
  lastDeliveryNote?: string;
}

/**
 * Routine planifiée d'un gent : une mission exécutée automatiquement côté
 * serveur (sans navigateur ouvert) qui produit une note dans l'espace.
 * L'heure est en heure de Paris ; le déclenchement effectif dépend du cron
 * qui appelle /api/routines/run (voir lib/server/routineRunner.ts).
 */
export interface Routine {
  enabled: boolean;
  frequency: "daily" | "weekly";
  /** Heure locale Europe/Paris (0–23) à partir de laquelle le run est dû. */
  hour: number;
  /** Mission envoyée au gent à chaque exécution (le « prompt » de la routine). */
  mission: string;
  /** Horodatage ISO du dernier run réussi (posé par le runner). */
  lastRunAt?: string;
  /** Compte-rendu court du dernier run (ok ou message d'erreur). */
  lastRunNote?: string;
}

export type EspacesMap = Record<string, Espace>;
