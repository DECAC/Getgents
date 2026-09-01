import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireDraftOwner } from "@/lib/server/gentGuard";

export const dynamic = "force-dynamic";

// Même convention d'id que les gents publiés (slug court généré par l'app).
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireDraftOwner(params.id);
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("gent_drafts")
    .select("draft")
    .eq("id", params.id)
    .eq("owner_id", acces.value.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft: data.draft });
}

export async function PUT(req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireDraftOwner(params.id);
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let body: { draft?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "missing_draft" }, { status: 400 });
  }

  // `owner_id` est imposé par le serveur, jamais lu depuis le corps de la
  // requête : l'accepter du client permettrait d'écrire chez quelqu'un d'autre.
  const { error } = await supabase
    .from("gent_drafts")
    .upsert({ id: params.id, draft: body.draft, owner_id: acces.value.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireDraftOwner(params.id);
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  // Le filtre sur owner_id est REDONDANT avec la garde, et c'est voulu : si
  // la garde changeait un jour, la requête elle-même refuserait encore de
  // toucher la ligne d'un autre compte.
  const { error } = await supabase
    .from("gent_drafts")
    .delete()
    .eq("id", params.id)
    .eq("owner_id", acces.value.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
