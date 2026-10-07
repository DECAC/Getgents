import { NextResponse } from "next/server";
import { adresseCourrier } from "@/lib/courrier";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Boîte d'arrivée du propriétaire pour UN gent : l'adresse e-mail du gent (si
 * le courrier est configuré) et les retouches en attente. Le navigateur les
 * applique par le chemin de « Garder », puis les marque (POST).
 */
export async function GET(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const gentId = new URL(req.url).searchParams.get("gentId") ?? "";
  if (!gentId) return NextResponse.json({ error: "gentId_manquant" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const secret = process.env.BREVO_INBOUND_SECRET ?? "";
  const { data, error } = await supabase
    .from("courrier_entrant")
    .select("id, recu_le, objet, resume, retouches")
    .eq("owner_id", auth.user.id)
    .eq("gent_id", gentId)
    .eq("statut", "en_attente")
    .order("recu_le", { ascending: true })
    .limit(20);
  // Table absente (migration 019 pas encore passée) : pas de courrier, sans casser l'ouverture.
  const courrier = error ? [] : data ?? [];
  return NextResponse.json({ adresse: secret ? adresseCourrier(gentId, secret) : null, courrier });
}

/** Marque des courriers comme appliqués — ceux du compte connecté seulement. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  if (!ids.length) return NextResponse.json({ ok: true });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { error } = await supabase
    .from("courrier_entrant")
    .update({ statut: "applique" })
    .in("id", ids)
    .eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
