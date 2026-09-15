import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import { describeShareLinksFailure, getShareLink, TOKEN_RE } from "@/lib/server/shareLinks";
import { canOpen, type ShareLink } from "@/lib/shareLink";
import type { CollabConfig, Espace } from "@/lib/types";

/**
 * Résolution commune des routes /api/collab/[token]/* : du jeton de lien de
 * partage vers la configuration collaboratif DIFFUSÉE du gent.
 *
 * Même discipline que /api/links/[token]/chat : la version servie est la
 * version diffusée (jamais la version de travail que le créateur remue en
 * Preview), et le refus suit le type discriminé du projet — l'appelant
 * retourne la réponse, il ne peut pas oublier et poursuivre.
 */

export interface CollabLinkContext {
  link: ShareLink;
  /** Version diffusée (projection serveur complète, prompt inclus). */
  espace: Espace;
  /** Configuration collaboratif, garantie activée. */
  collab: CollabConfig;
}

export type CollabLinkOutcome = { ok: true; value: CollabLinkContext } | { ok: false; response: NextResponse };

function refus(status: number, error: string, extra?: Record<string, unknown>) {
  return { ok: false as const, response: NextResponse.json({ error, ...extra }, { status }) };
}

export async function resolveCollabLink(token: string): Promise<CollabLinkOutcome> {
  if (!TOKEN_RE.test(token)) return refus(400, "invalid_token");

  const supabase = getSupabaseAdmin();
  if (!supabase) return refus(503, "supabase_not_configured");

  let link;
  try {
    link = await getShareLink(token);
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return refus(status, error, hint ? { hint } : undefined);
  }
  if (!link) return refus(404, "link_not_found");
  if (!canOpen(link)) return refus(403, "link_unavailable");

  const { data, error } = await supabase
    .from("published_gents")
    .select(DIFFUSED_COLUMNS)
    .eq("id", link.gentId)
    .maybeSingle();
  if (error) return refus(500, error.message);
  const espace = diffusedEspace(data);
  if (!espace) return refus(404, "gent_not_found");

  // Un lien ordinaire vers un gent NON collaboratif n'ouvre pas de salon :
  // 404, comme pour un gent absent — confirmer que la configuration existe
  // renseignerait déjà l'appelant.
  const collab = espace.collab;
  if (!collab?.enabled) return refus(404, "not_a_collab_gent");

  return { ok: true, value: { link, espace, collab } };
}
