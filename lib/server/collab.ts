import { randomBytes } from "crypto";
import { getSupabaseAdmin, missingSupabaseEnvVars } from "@/lib/server/supabase";
import { generateToken } from "@/lib/server/shareLinks";
import type {
  CollabMessage,
  CollabMessageKind,
  CollabParticipant,
  CollabRole,
  CollabSessionStatus,
} from "@/lib/collab";

// Accès Supabase aux tables du gent collaboratif (migration 014), sur le
// modèle de lib/server/shareLinks.ts : erreurs enrichies du code Postgres
// d'origine, et un diagnostic actionnable quand la migration n'a jamais été
// exécutée. Le filtrage de visibilité n'est PAS ici : il vit dans le module
// pur lib/collab.ts, appliqué par les routes.

export interface CollabSession {
  id: string;
  token: string;
  gentId: string;
  status: CollabSessionStatus;
  collection: Record<string, Record<string, unknown>>;
  synthesis: Record<string, unknown>;
  orchestrationCount: number;
  maxOrchestrations: number;
  createdAt: string;
}

/** Erreur Supabase enrichie du code Postgres/PostgREST d'origine. */
export class CollabError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function raise(error: { message: string; code?: string }): never {
  throw new CollabError(error.message, error.code);
}

/**
 * Message actionnable pour un échec touchant le collaboratif. La cause la
 * plus fréquente : la migration 014_collab_sessions.sql n'a jamais été
 * exécutée dans le projet Supabase (tables absentes) — sans ce diagnostic,
 * l'appelant ne voit qu'un message Postgres brut, jamais actionnable.
 */
export function describeCollabFailure(e: unknown): { error: string; hint?: string; status: number } {
  if (e instanceof Error && e.message === "supabase_not_configured") {
    const missing = missingSupabaseEnvVars();
    return {
      error: e.message,
      status: 503,
      hint:
        (missing.length
          ? `Variable(s) manquante(s) sur le serveur : ${missing.join(", ")}. `
          : "Le gent collaboratif exige Supabase. ") +
        "Configurez-la(les) dans l'environnement du déploiement, REDÉPLOYEZ, puis exécutez " +
        "supabase/migrations/014_collab_sessions.sql dans le SQL Editor si ce n'est pas déjà fait.",
    };
  }
  const code = e instanceof CollabError ? e.code : undefined;
  const message = e instanceof Error ? e.message : "erreur inconnue";
  // 42P01 (Postgres) / PGRST205 (PostgREST) : relation absente. PGRST202 : la
  // fonction collab_orchestration_* n'existe pas (même migration manquante).
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
        "Les tables du gent collaboratif n'existent pas encore dans ce projet Supabase : ouvrez le SQL Editor " +
        "(projet dont l'URL est dans NEXT_PUBLIC_SUPABASE_URL), exécutez supabase/migrations/014_collab_sessions.sql, " +
        "puis réessayez.",
    };
  }
  return { error: message, status: 500 };
}

/** Id court de participant (12 caractères) — distinct du token, non secret. */
function generateParticipantId(): string {
  return `p_${randomBytes(9).toString("base64url")}`;
}

/** Id de session. */
function generateSessionId(): string {
  return `cs_${randomBytes(18).toString("base64url")}`;
}

interface SessionRow {
  id: string;
  token: string;
  gent_id: string;
  status: CollabSessionStatus;
  collection: Record<string, Record<string, unknown>>;
  synthesis: Record<string, unknown>;
  orchestration_count: number;
  max_orchestrations: number;
  created_at: string;
}

function toSession(row: SessionRow): CollabSession {
  return {
    id: row.id,
    token: row.token,
    gentId: row.gent_id,
    status: row.status,
    collection: row.collection ?? {},
    synthesis: row.synthesis ?? {},
    orchestrationCount: row.orchestration_count,
    maxOrchestrations: row.max_orchestrations,
    createdAt: row.created_at,
  };
}

interface ParticipantRow {
  id: string;
  session_id: string;
  name: string;
  participant_token: string;
  role: CollabRole;
  last_seen_at: string;
}

function toParticipant(row: ParticipantRow): CollabParticipant {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    lastSeenAt: row.last_seen_at,
  };
}

interface MessageRow {
  id: number;
  session_id: string;
  channel: string;
  author: string;
  author_name: string;
  kind: CollabMessageKind;
  text: string;
  payload: unknown;
  created_at: string;
}

function toMessage(row: MessageRow): CollabMessage {
  return {
    id: row.id,
    channel: row.channel,
    author: row.author,
    authorName: row.author_name,
    kind: row.kind,
    text: row.text,
    payload: row.payload ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Sessions ─────────────────────────────────────────────────────────────

export async function getCollabSession(token: string): Promise<CollabSession | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) raise(error);
  return data ? toSession(data as SessionRow) : null;
}

/** Toutes les sessions collaboratives d'un gent (suivi créateur). */
export async function listCollabSessionsForGent(gentId: string): Promise<CollabSession[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_sessions")
    .select("*")
    .eq("gent_id", gentId)
    .order("created_at", { ascending: false });
  if (error) raise(error);
  return ((data ?? []) as SessionRow[]).map(toSession);
}

/**
 * La session du lien, créée à la première arrivée. Le `upsert` sur l'index
 * unique `token` rend l'opération idempotente : deux participants qui
 * ouvrent le lien en même temps ne créent pas deux salons.
 */
export async function getOrCreateCollabSession(token: string, gentId: string): Promise<CollabSession> {
  const existing = await getCollabSession(token);
  if (existing) return existing;

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_sessions")
    .upsert({ id: generateSessionId(), token, gent_id: gentId }, { onConflict: "token" })
    .select()
    .single();
  if (error) raise(error);
  return toSession(data as SessionRow);
}

/** Mise à jour du statut de la mission (collecting → proposing → done). */
export async function updateCollabSessionStatus(id: string, status: CollabSessionStatus): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { error } = await supabase.from("collab_sessions").update({ status }).eq("id", id);
  if (error) raise(error);
}

/**
 * Réécrit la collection (réponses par participant/question). Appelé
 * UNIQUEMENT par l'orchestrateur, sous mutex — pas de fusion nécessaire.
 */
export async function writeCollabCollection(
  id: string,
  collection: Record<string, Record<string, unknown>>
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { error } = await supabase.from("collab_sessions").update({ collection }).eq("id", id);
  if (error) raise(error);
}

/** Fusion peu profonde d'un patch dans la synthèse (clés de premier niveau). */
export async function patchCollabSynthesis(id: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_sessions")
    .select("synthesis")
    .eq("id", id)
    .maybeSingle();
  if (error) raise(error);
  const current = ((data?.synthesis as Record<string, unknown> | null) ?? {}) || {};
  const next = { ...current, ...patch };
  const { error: upError } = await supabase
    .from("collab_sessions")
    .update({ synthesis: next })
    .eq("id", id);
  if (upError) raise(upError);
}

// ── Participants ─────────────────────────────────────────────────────────

export async function listCollabParticipants(sessionId: string): Promise<CollabParticipant[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("last_seen_at", { ascending: true });
  if (error) raise(error);
  return ((data ?? []) as ParticipantRow[]).map(toParticipant);
}

/** Participant complet (avec session) à partir de son jeton — l'identifiant de session de fait. */
export async function getCollabParticipant(
  participantToken: string
): Promise<{ participant: CollabParticipant; sessionId: string } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_participants")
    .select("*")
    .eq("participant_token", participantToken)
    .maybeSingle();
  if (error) raise(error);
  if (!data) return null;
  return { participant: toParticipant(data as ParticipantRow), sessionId: (data as ParticipantRow).session_id };
}

export async function createCollabParticipant(input: {
  sessionId: string;
  name: string;
  role: CollabRole;
}): Promise<{ participant: CollabParticipant; participantToken: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const participantToken = generateToken();
  const { data, error } = await supabase
    .from("collab_participants")
    .insert({
      id: generateParticipantId(),
      session_id: input.sessionId,
      name: input.name,
      participant_token: participantToken,
      role: input.role,
    })
    .select()
    .single();
  if (error) raise(error);
  return { participant: toParticipant(data as ParticipantRow), participantToken };
}

/** Présence : rafraîchie à chaque appel d'état. Best-effort, jamais bloquant. */
export async function touchCollabParticipant(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase
      .from("collab_participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
  } catch {
    // présence non critique
  }
}

// ── Messages ─────────────────────────────────────────────────────────────

export async function insertCollabMessage(input: {
  sessionId: string;
  channel: string;
  author: string;
  authorName: string;
  kind?: CollabMessageKind;
  text: string;
  payload?: unknown;
}): Promise<CollabMessage> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_messages")
    .insert({
      session_id: input.sessionId,
      channel: input.channel,
      author: input.author,
      author_name: input.authorName,
      kind: input.kind ?? "text",
      text: input.text,
      payload: input.payload ?? null,
    })
    .select()
    .single();
  if (error) raise(error);
  return toMessage(data as MessageRow);
}

/**
 * Les N messages les plus récents de la session, TOUS canaux confondus,
 * rendus en ordre chronologique. C'est volontairement brut : la décision de
 * qui voit quoi appartient à lib/collab.ts (appliquée par l'appelant), pas
 * à une requête SQL dupliquée dans chaque route.
 */
export async function listRecentCollabMessages(sessionId: string, limit = 500): Promise<CollabMessage[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase
    .from("collab_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) raise(error);
  return ((data ?? []) as MessageRow[]).map(toMessage).reverse();
}

// ── Garde-fous d'orchestration (mutex + plafond) ─────────────────────────

/**
 * Tente de démarrer un tick d'orchestration : atomiquement, pose le mutex et
 * consomme une unité du plafond. Renvoie le nouveau compteur, ou -1 si un
 * tick est déjà en cours ou si le plafond est atteint — l'appelant s'abstient
 * alors (le tick en cours verra les messages arrivés entre-temps).
 */
export async function collabOrchestrationBegin(sessionId: string, max?: number): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return -1;
  const { data, error } = await supabase.rpc("collab_orchestration_begin", {
    p_session: sessionId,
    p_max: max ?? null,
  });
  if (error || typeof data !== "number") return -1;
  return data;
}

/** Relâche le mutex d'orchestration — à appeler en finally, quoi qu'il arrive. */
export async function collabOrchestrationEnd(sessionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  try {
    await supabase.rpc("collab_orchestration_end", { p_session: sessionId });
  } catch {
    // Le mutex se libérera au prochain déploiement / réécriture ; ne jamais
    // faire échouer la requête appelante pour ça.
  }
}
