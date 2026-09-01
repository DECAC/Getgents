import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireGentAccess } from "@/lib/server/gentGuard";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const UUID_RE = /^[0-9a-f-]{36}$/i;

interface Params {
  params: { id: string; grantId: string };
}

/** Retirer l'accès d'une personne — immédiat. */
export async function DELETE(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id) || !UUID_RE.test(params.grantId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  // Révocation par horodatage plutôt que suppression : on garde la trace de
  // qui a eu accès, et une ré-invitation réutilise la même ligne.
  // Le filtre sur `gent_id` est redondant avec la garde, et c'est voulu : la
  // requête refuserait d'elle-même de toucher l'invitation d'un autre gent.
  const { error } = await supabase
    .from("gent_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.grantId)
    .eq("gent_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
