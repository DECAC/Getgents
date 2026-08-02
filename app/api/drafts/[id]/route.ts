import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { checkAppAccess, APP_ACCESS_HINT } from "@/lib/server/appAccess";

export const dynamic = "force-dynamic";

const unauthorized = () =>
  NextResponse.json({ error: "unauthorized", hint: APP_ACCESS_HINT }, { status: 401 });

// Même convention d'id que les gents publiés (slug court généré par l'app).
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

export async function GET(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return unauthorized();
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("gent_drafts")
    .select("draft")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ draft: data.draft });
}

export async function PUT(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return unauthorized();
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  let body: { draft?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.draft || typeof body.draft !== "object") {
    return NextResponse.json({ error: "missing_draft" }, { status: 400 });
  }

  const { error } = await supabase.from("gent_drafts").upsert({ id: params.id, draft: body.draft });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return unauthorized();
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { error } = await supabase.from("gent_drafts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
