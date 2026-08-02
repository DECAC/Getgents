import { randomBytes } from "crypto";
import { getSupabaseAdmin, missingSupabaseEnvVars } from "@/lib/server/supabase";
import type { ShareEventKind, ShareLink, ShareLinkStats } from "@/lib/shareLink";

// Accès Supabase aux liens de partage et à leur journal d'événements.
// Contrairement au reste du repo (upsert du document espace entier), les
// événements sont écrits en insert append-only : ils ne doivent jamais être
// écrasés par une réécriture concurrente.

/** Format du token : 32 caractères base64url — non devinable, sûr en URL. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

/** Erreur Supabase enrichie du code Postgres/PostgREST d'origine. */
export class ShareLinksError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function raise(error: { message: string; code?: string }): never {
  throw new ShareLinksError(error.message, error.code);
}

/**
 * Message actionnable pour un échec touchant les liens de partage. La cause la
 * plus fréquente en pratique : la migration 002_share_links.sql n'a jamais été
 * exécutée dans le projet Supabase (les tables n'existent pas). Sans ce
 * diagnostic, l'appelant ne voit qu'un message Postgres brut — souvent en
 * anglais, jamais actionnable — et ne peut pas deviner quoi faire.
 */
export function describeShareLinksFailure(e: unknown): { error: string; hint?: string; status: number } {
  if (e instanceof Error && e.message === "supabase_not_configured") {
    const missing = missingSupabaseEnvVars();
    return {
      error: e.message,
      status: 503,
      hint:
        (missing.length
          ? `Variable(s) manquante(s) sur le serveur : ${missing.join(", ")}. `
          : "Les liens de partage exigent Supabase. ") +
        "Configurez-la(les) dans Vercel → Settings → Environment Variables pour l'environnement Production, " +
        "REDÉPLOYEZ (une variable ajoutée ne s'applique pas au déploiement déjà en ligne), puis exécutez " +
        "supabase/migrations/001_published_gents.sql et 002_share_links.sql dans le SQL Editor si ce n'est pas déjà fait.",
    };
  }
  const code = e instanceof ShareLinksError ? e.code : undefined;
  const message = e instanceof Error ? e.message : "erreur inconnue";
  // 42P01 (Postgres) / PGRST205 (PostgREST) : relation absente. PGRST202 : la
  // fonction increment_share_refresh n'existe pas (même migration manquante).
  const missingSchema =
    code === "42P01" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    /relation .* does not exist|could not find the (table|function)/i.test(message);
  if (missingSchema) {
    return {
      error: message,
      status: 503,
      hint:
        "La table des liens de partage n'existe pas encore dans ce projet Supabase : ouvrez le SQL Editor du projet " +
        "(celui dont l'URL est dans NEXT_PUBLIC_SUPABASE_URL) et exécutez le contenu de supabase/migrations/002_share_links.sql, " +
        "puis réessayez.",
    };
  }
  return { error: message, status: 500 };
}

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

interface ShareLinkRow {
  token: string;
  gent_id: string;
  target_label: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  allow_chat: boolean;
  allow_refresh: boolean;
  refresh_count: number;
  max_refresh: number;
}

function toShareLink(row: ShareLinkRow): ShareLink {
  return {
    token: row.token,
    gentId: row.gent_id,
    targetLabel: row.target_label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    allowChat: row.allow_chat,
    allowRefresh: row.allow_refresh,
    refreshCount: row.refresh_count,
    maxRefresh: row.max_refresh,
  };
}

export interface CreateShareLinkInput {
  gentId: string;
  targetLabel: string;
  expiresAt?: string | null;
  allowChat?: boolean;
  allowRefresh?: boolean;
  maxRefresh?: number;
}

export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const row = {
    token: generateToken(),
    gent_id: input.gentId,
    target_label: input.targetLabel,
    expires_at: input.expiresAt ?? null,
    allow_chat: input.allowChat ?? true,
    allow_refresh: input.allowRefresh ?? true,
    max_refresh: input.maxRefresh ?? 20,
  };
  const { data, error } = await supabase.from("share_links").insert(row).select().single();
  if (error) raise(error);
  return toShareLink(data as ShareLinkRow);
}

export async function getShareLink(token: string): Promise<ShareLink | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase.from("share_links").select("*").eq("token", token).maybeSingle();
  if (error) raise(error);
  return data ? toShareLink(data as ShareLinkRow) : null;
}

export async function listShareLinks(gentId: string): Promise<ShareLink[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("gent_id", gentId)
    .order("created_at", { ascending: false });
  if (error) raise(error);
  return ((data ?? []) as ShareLinkRow[]).map(toShareLink);
}

export async function revokeShareLink(token: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
  if (error) raise(error);
}

/**
 * Enregistre un événement. Volontairement silencieux en cas d'échec : le
 * tracking ne doit jamais empêcher la cible d'accéder au contenu.
 */
export async function recordShareEvent(token: string, kind: ShareEventKind, detail?: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase.from("share_events").insert({ token, kind, detail: detail ?? null });
  } catch {
    // journal indisponible — sans conséquence pour le visiteur
  }
}

/** Incrément atomique du compteur de régénérations (fonction SQL dédiée). */
export async function incrementRefreshCount(token: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("increment_share_refresh", { p_token: token });
  if (error) return null;
  return typeof data === "number" ? data : null;
}

/**
 * Le gent existe-t-il réellement dans `published_gents` ? Un lien peut être
 * parfaitement valide (créé, non expiré) alors que le gent qu'il pointe n'a
 * jamais atteint le serveur — cas vécu : tant que Supabase n'était pas
 * configuré, chaque publication n'écrivait que le localStorage du créateur.
 * Un visiteur ouvrant le lien voit alors « Contenu indisponible » sans que le
 * créateur, lui, s'en aperçoive (son propre navigateur a toujours le cache
 * local). Exposer ce fait côté créateur évite cette confusion.
 */
export async function gentPublishedInDb(gentId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { data } = await supabase.from("published_gents").select("id").eq("id", gentId).maybeSingle();
  return !!data;
}

/** Agrégats de tracking pour un lot de liens (une seule requête). */
export async function statsForTokens(tokens: string[]): Promise<Record<string, ShareLinkStats>> {
  const out: Record<string, ShareLinkStats> = {};
  if (tokens.length === 0) return out;
  const supabase = getSupabaseAdmin();
  if (!supabase) return out;

  const { data, error } = await supabase
    .from("share_events")
    .select("token, kind, at")
    .in("token", tokens)
    .order("at", { ascending: true });
  if (error) return out;

  for (const row of (data ?? []) as { token: string; kind: ShareEventKind; at: string }[]) {
    const s = (out[row.token] ??= { openCount: 0, chatCount: 0, refreshCount: 0 });
    if (row.kind === "open") {
      s.openCount++;
      s.firstOpenAt ??= row.at;
    } else if (row.kind === "chat") s.chatCount++;
    else if (row.kind === "refresh") s.refreshCount++;
    s.lastEventAt = row.at;
  }
  return out;
}
