import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireUser, type SessionUser } from "@/lib/server/session";
import { resolveAccess, canRead, canWrite, canAdminister, type GentRole, type GentGrant } from "@/lib/gentAccess";
import { limitFor, quotaMessage, windowStart, type UsageKind } from "@/lib/rateLimit";
import { contexteForUser, type ContexteLlm } from "@/lib/server/openRouterKey";
import { quotaApplicable, MESSAGE_VISITEUR_INDISPONIBLE } from "@/lib/openRouterKey";

/**
 * Contrôle d'appartenance sur un gent, et plafonds d'usage.
 *
 * Règle à tenir dans tout le projet : aucune lecture ni écriture d'un gent
 * sans passer par ici. Le serveur utilise la clé `service_role`, qui contourne
 * le RLS — c'est donc CE code qui cloisonne les comptes, et rien d'autre.
 */

export type GuardOutcome<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function refus(status: number, error: string, extra?: Record<string, unknown>) {
  return { ok: false as const, response: NextResponse.json({ error, ...extra }, { status }) };
}

async function grantsFor(gentId: string): Promise<GentGrant[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase
    .from("gent_grants")
    .select("grantee_id, invited_email, role, revoked_at")
    .eq("gent_id", gentId)
    .is("revoked_at", null);
  return (data ?? []).map((g) => ({
    granteeId: g.grantee_id as string | null,
    invitedEmail: (g.invited_email as string) ?? "",
    role: g.role === "editor" ? "editor" : "viewer",
    revokedAt: (g.revoked_at as string | null) ?? null,
  }));
}

export interface GentContext {
  user: SessionUser;
  role: GentRole;
  /** Ligne brute, déjà chargée : évite de la relire dans la route. */
  row: Record<string, unknown>;
}

/**
 * Charge un gent publié et évalue le droit du demandeur.
 *
 * `niveau` dit ce qu'on s'apprête à faire : lire, écrire, ou disposer du gent
 * (supprimer, partager, publier — réservé au propriétaire).
 */
export async function requireGentAccess(
  gentId: string,
  niveau: "read" | "write" | "admin"
): Promise<GuardOutcome<GentContext>> {
  const auth = await requireUser();
  if ("response" in auth) return { ok: false, response: auth.response };

  const supabase = getSupabaseAdmin();
  if (!supabase) return refus(503, "supabase_not_configured");

  const { data, error } = await supabase
    .from("published_gents")
    .select("*")
    .eq("id", gentId)
    .maybeSingle();
  if (error) return refus(500, error.message);
  if (!data) return refus(404, "not_found");

  const role = resolveAccess({
    ownerId: (data.owner_id as string | null) ?? null,
    visibility: (data.visibility as "private" | "shared" | "public") ?? "private",
    grants: await grantsFor(gentId),
    userId: auth.user.id,
    userEmail: auth.user.confirmedEmail,
  });

  const autorise =
    niveau === "read" ? canRead(role) : niveau === "write" ? canWrite(role) : canAdminister(role);

  // 404 plutôt que 403 sur une lecture refusée : confirmer l'existence d'un
  // gent qu'on n'a pas le droit de voir renseigne déjà l'appelant.
  if (!autorise) return refus(role === "none" ? 404 : 403, role === "none" ? "not_found" : "forbidden");

  return { ok: true, value: { user: auth.user, role, row: data } };
}

/** Même contrôle pour un brouillon : strictement le propriétaire, pas de partage. */
export async function requireDraftOwner(draftId: string): Promise<GuardOutcome<{ user: SessionUser }>> {
  const auth = await requireUser();
  if ("response" in auth) return { ok: false, response: auth.response };

  const supabase = getSupabaseAdmin();
  if (!supabase) return refus(503, "supabase_not_configured");

  const { data, error } = await supabase
    .from("gent_drafts")
    .select("owner_id")
    .eq("id", draftId)
    .maybeSingle();
  if (error) return refus(500, error.message);

  // Brouillon inexistant : autorisé, c'est une création (PUT sur un id neuf).
  if (!data) return { ok: true, value: { user: auth.user } };

  const owner = (data.owner_id as string | null) ?? null;
  if (owner && owner !== auth.user.id) return refus(404, "not_found");

  return { ok: true, value: { user: auth.user } };
}

/**
 * Consomme une unité de quota. Renvoie un refus 429 si le plafond est atteint.
 * Une base indisponible ne bloque pas l'appel : le quota borne le coût, il
 * n'est pas une garde de sécurité — refuser ici punirait l'utilisateur d'une
 * panne d'infrastructure.
 */
export async function consumeQuota(userId: string, kind: UsageKind): Promise<GuardOutcome<number>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: true, value: 0 };

  const maintenant = new Date();
  const { data, error } = await supabase.rpc("bump_usage", {
    p_user: userId,
    p_kind: kind,
    p_window: windowStart(maintenant),
    p_limit: limitFor(kind),
  });

  if (error) {
    console.error(
      JSON.stringify({ tag: "getgents:quota", event: "bump_failed", kind, detail: error.message })
    );
    return { ok: true, value: 0 };
  }

  const compte = typeof data === "number" ? data : 0;
  if (compte < 0) {
    return refus(429, quotaMessage(kind, maintenant), { kind, limit: limitFor(kind) });
  }
  return { ok: true, value: compte };
}

/**
 * Accès à un gent identifié par un id qui peut désigner un gent PUBLIÉ ou un
 * simple BROUILLON — le cas des connecteurs, qu'on branche avant d'avoir
 * diffusé quoi que ce soit. On accepte si l'un des deux appartient au compte.
 */
export async function requireGentOrDraftAccess(
  gentId: string,
  niveau: "read" | "write" | "admin"
): Promise<GuardOutcome<SessionUser>> {
  const auth = await requireUser();
  if ("response" in auth) return { ok: false, response: auth.response };

  const supabase = getSupabaseAdmin();
  if (!supabase) return refus(503, "supabase_not_configured");

  const { data: publie } = await supabase
    .from("published_gents")
    .select("id")
    .eq("id", gentId)
    .maybeSingle();

  if (publie) {
    const acces = await requireGentAccess(gentId, niveau);
    if (!acces.ok) return { ok: false, response: acces.response };
    return { ok: true, value: acces.value.user };
  }

  const { data: brouillon } = await supabase
    .from("gent_drafts")
    .select("owner_id")
    .eq("id", gentId)
    .maybeSingle();

  if (!brouillon) return refus(404, "not_found");

  const owner = (brouillon.owner_id as string | null) ?? null;
  // Un brouillon sans propriétaire est un vestige d'avant les comptes : la
  // reprise (migration 010) lui en donne un au premier login. Le refuser ici
  // serait plus sûr, mais rendrait inaccessible un gent en cours de
  // construction sur une instance dont la reprise n'a pas encore eu lieu.
  if (owner && owner !== auth.user.id) return refus(404, "not_found");

  return { ok: true, value: auth.user };
}

/**
 * Consomme le quota UNIQUEMENT si la plateforme paie.
 *
 * L'ordre compte : on résout d'abord la source, on décompte ensuite. Faire
 * l'inverse ferait monter le compteur d'un builder qui règle déjà ses propres
 * appels — un plafond appliqué à une dépense qui n'est pas la nôtre.
 */
export async function consommerSiPlateforme(
  ctx: ContexteLlm,
  kind: UsageKind
): Promise<GuardOutcome<number>> {
  if (!quotaApplicable(ctx.source) || !ctx.ownerId) return { ok: true, value: 0 };
  return consumeQuota(ctx.ownerId, kind);
}

/**
 * Quota d'un chemin SANS session : lien de partage, gent public, WhatsApp,
 * routine. C'est le quota du PROPRIÉTAIRE qui est décompté — la vraie
 * protection contre « je publie un gent, dix mille visiteurs vident la clé
 * commune ». Le refus s'adresse au visiteur, qui n'a rien à faire du plafond
 * horaire de quelqu'un d'autre.
 */
export async function consommerPourVisiteur(
  ctx: ContexteLlm,
  kind: UsageKind
): Promise<GuardOutcome<number>> {
  const quota = await consommerSiPlateforme(ctx, kind);
  if (quota.ok) return quota;
  return refus(429, MESSAGE_VISITEUR_INDISPONIBLE);
}

export interface UserAvecContexte {
  user: SessionUser;
  /** Qui paie ce tour, et avec quelle clé. À passer aux modules de génération. */
  ctx: ContexteLlm;
}

/** Raccourci : session + contexte de facturation + quota, le trio de toutes
 *  les routes de génération. */
export async function requireUserWithQuota(
  kind: UsageKind
): Promise<GuardOutcome<UserAvecContexte>> {
  const auth = await requireUser();
  if ("response" in auth) return { ok: false, response: auth.response };

  const ctx = await contexteForUser(auth.user.id);

  const quota = await consommerSiPlateforme(ctx, kind);
  if (!quota.ok) return quota;

  return { ok: true, value: { user: auth.user, ctx } };
}
