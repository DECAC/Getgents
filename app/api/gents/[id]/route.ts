import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { checkAppAccess, APP_ACCESS_HINT } from "@/lib/server/appAccess";
import { deleteShareLinksForGent } from "@/lib/server/shareLinks";

export const dynamic = "force-dynamic";

// Une Response ne peut être consommée qu'une fois : on en construit une neuve
// à chaque refus plutôt que de partager une instance de module.
const unauthorized = () => NextResponse.json({ error: "unauthorized", hint: APP_ACCESS_HINT }, { status: 401 });

// Un id de gent est un slug court généré par l'app (ex. "sanisettes-paris",
// "gent-1721...") — on borne pour écarter les payloads exotiques.
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
    .from("published_gents")
    .select("espace")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ espace: data.espace });
}

export async function PUT(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return unauthorized();
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  let body: { espace?: unknown; diffuse?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.espace || typeof body.espace !== "object") {
    return NextResponse.json({ error: "missing_espace" }, { status: 400 });
  }

  // `diffuse` distingue les deux gestes du créateur : enregistrer sa version
  // de travail (Preview, sauvegardes au fil de l'eau) ne doit RIEN changer
  // pour les utilisateurs — seul « Diffuser le gent » fige la version
  // qu'ils reçoivent (voir lib/server/gentVersions.ts).
  const row: Record<string, unknown> = { id: params.id, espace: body.espace };
  if (body.diffuse) {
    row.diffused = body.espace;
    row.diffused_at = new Date().toISOString();
  }

  const { error } = await supabase.from("published_gents").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return unauthorized();
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  // Nettoie les liens de partage AVANT de supprimer le gent : sinon, en cas
  // d'échec du nettoyage, on se retrouverait avec des liens orphelins
  // pointant vers un gent déjà supprimé, sans plus aucun moyen de les
  // retrouver depuis l'app (ils ne sont listés que par gentId).
  await deleteShareLinksForGent(params.id);

  const { error } = await supabase.from("published_gents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
