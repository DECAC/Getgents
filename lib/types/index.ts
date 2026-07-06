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
  | "artef-proposal";

export interface ConversationThread {
  id: string;
  startedAt: string;
  messages: ConversationMessage[];
}

export interface ArtefactProposal {
  kind: "report" | "checklist" | "chart" | "visual";
  title: string;
  body?: string;
  items?: string[];
  chartData?: { label: string; value: number }[];
}

export interface ConversationMessage {
  id?: string;
  role: ConversationRole;
  text?: string;
  t?: string;
  kind?: string;
  what?: string;
  ok?: boolean;
  ref?: string;
  tab?: string;
  icon?: string;
  status?: "pending" | "sent";
  title?: string;
  link?: string;
  questions?: { q: string; options: string[]; multi?: boolean }[];
  proposal?: ArtefactProposal;
  proposalStatus?: "pending" | "added" | "dismissed";
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
}

export interface EspaceMetric {
  value: string;
  suffix?: string;
  label: string;
  warn?: boolean;
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
  systemPrompt?: string;
  chatModelId?: string;
  /** Serveurs MCP (transport Streamable HTTP) configurés dans le builder. */
  mcpServers?: { name: string; url: string }[];
}

export type EspacesMap = Record<string, Espace>;
