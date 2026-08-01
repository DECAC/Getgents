// Types et règles des liens de partage — module pur, utilisable côté serveur
// comme côté client (et testable sans Supabase), sur le modèle de
// lib/routineSchedule.ts.

export interface ShareLink {
  token: string;
  gentId: string;
  targetLabel: string;
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  allowChat: boolean;
  allowRefresh: boolean;
  refreshCount: number;
  maxRefresh: number;
}

export type ShareEventKind = "open" | "chat" | "refresh";

/** Agrégats de tracking d'un lien, dérivés du journal share_events. */
export interface ShareLinkStats {
  openCount: number;
  chatCount: number;
  refreshCount: number;
  firstOpenAt?: string;
  lastEventAt?: string;
}

export type ShareLinkState = "active" | "expired" | "revoked" | "exhausted";

export function shareLinkState(link: ShareLink, now: Date = new Date()): ShareLinkState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) return "expired";
  if (link.allowRefresh && link.refreshCount >= link.maxRefresh) return "exhausted";
  return "active";
}

/** Un lien épuisé reste consultable : seule la régénération est bloquée. */
export function canOpen(link: ShareLink, now: Date = new Date()): boolean {
  const state = shareLinkState(link, now);
  return state === "active" || state === "exhausted";
}

export function canRefresh(link: ShareLink, now: Date = new Date()): boolean {
  return link.allowRefresh && shareLinkState(link, now) === "active";
}

export function canChat(link: ShareLink, now: Date = new Date()): boolean {
  return link.allowChat && canOpen(link, now);
}

export function shareLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/l/${token}`;
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-FR", DATE_FMT);
}

/** Phrase de statut affichée dans l'onglet Diffusion et dans les rapports. */
export function describeShareLink(link: ShareLink, stats?: ShareLinkStats): string {
  const state = shareLinkState(link);
  const parts: string[] = [];

  if (state === "revoked") parts.push(`révoqué le ${fmt(link.revokedAt)}`);
  else if (state === "expired") parts.push(`expiré le ${fmt(link.expiresAt)}`);
  else if (state === "exhausted") parts.push(`quota atteint (${link.refreshCount}/${link.maxRefresh})`);
  else parts.push("actif");

  if (!stats || stats.openCount === 0) {
    parts.push("jamais ouvert");
  } else {
    parts.push(`ouvert ${stats.openCount} fois (1re : ${fmt(stats.firstOpenAt)})`);
    const used: string[] = [];
    if (stats.refreshCount > 0) used.push(`${stats.refreshCount} régénération${stats.refreshCount > 1 ? "s" : ""}`);
    if (stats.chatCount > 0) used.push(`${stats.chatCount} échange${stats.chatCount > 1 ? "s" : ""}`);
    parts.push(used.length ? used.join(", ") : "consulté sans interaction");
  }
  return parts.join(" · ");
}
