import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireUser } from "@/lib/server/session";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { deleteShareLinksForGent } from "@/lib/server/shareLinks";

export const dynamic = "force-dynamic";

// Un id de gent est un slug court généré par l'app (ex. "sanisettes-paris",
// "gent-1721...") — on borne pour écarter les payloads exotiques.
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireGentAccess(params.id, "read");
  if (!acces.ok) return acces.response;

  return NextResponse.json({ espace: acces.value.row.espace, role: acces.value.role });
}

export async function PUT(req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let body: { espace?: unknown; diffuse?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.espace || typeof body.espace !== "object") {
    return NextResponse.json({ error: "missing_espace" }, { status: 400 });
  }

  // Le gent existe-t-il déjà ? S'il existe, il faut le droit d'écriture ;
  // sinon c'est une création, et le créateur en devient le propriétaire.
  const { data: existant } = await supabase
    .from("published_gents")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  let ownerId: string;
  if (existant) {
    const acces = await requireGentAccess(params.id, "write");
    if (!acces.ok) return acces.response;
    // Le propriétaire ne change JAMAIS par une écriture de contenu : un
    // co-éditeur qui enregistre ne s'approprie pas le gent.
    ownerId = (acces.value.row.owner_id as string | null) ?? acces.value.user.id;
  } else {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    ownerId = auth.user.id;
  }

  // `diffuse` distingue les deux gestes du créateur : enregistrer sa version
  // de travail (Preview, sauvegardes au fil de l'eau) ne doit RIEN changer
  // pour les utilisateurs — seul « Diffuser le gent » fige la version
  // qu'ils reçoivent (voir lib/server/gentVersions.ts).
  const row: Record<string, unknown> = { id: params.id, espace: body.espace, owner_id: ownerId };
  if (body.diffuse) {
    row.diffused = body.espace;
    row.diffused_at = new Date().toISOString();
  }

  const { error } = await supabase.from("published_gents").upsert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  // Supprimer, c'est disposer du gent : réservé au propriétaire. Un
  // co-éditeur travaille dessus, il ne peut pas l'effacer.
  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  // Nettoie les liens de partage AVANT de supprimer le gent : sinon, en cas
  // d'échec du nettoyage, on se retrouverait avec des liens orphelins
  // pointant vers un gent déjà supprimé, sans plus aucun moyen de les
  // retrouver depuis l'app (ils ne sont listés que par gentId).
  await deleteShareLinksForGent(params.id);

  const { error } = await supabase.from("published_gents").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
