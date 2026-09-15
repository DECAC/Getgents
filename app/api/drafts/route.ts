import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Brouillons du compte connecté — map id → draft.
 *
 * Renvoyait auparavant TOUS les brouillons de la base. Un brouillon porte le
 * prompt système en cours d'écriture et les documents de connaissance de son
 * auteur : il ne se partage pas, même à un co-éditeur du gent publié.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("gent_drafts")
    .select("id, draft")
    .eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const drafts: Record<string, unknown> = {};
  for (const row of data ?? []) drafts[row.id] = row.draft;
  return NextResponse.json({ drafts });
}
