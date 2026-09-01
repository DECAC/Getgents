import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { slugMessage, slugProbleme, slugSuivant, toSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

/**
 * Publier un gent à la racine du domaine — `getgents.ai/<slug>` — ou l'en
 * retirer.
 *
 * Publier est un geste de PROPRIÉTAIRE : c'est lui qui expose son travail au
 * monde et qui en portera le coût de conversation.
 */
export async function POST(req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  let body: { visibility?: string; slug?: string; summary?: string; publicChat?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  // Dépublier : on garde le slug en base plutôt que de le libérer. Une adresse
  // déjà partagée ou indexée ne doit pas pouvoir être reprise par un autre
  // gent — le visiteur atterrirait ailleurs que là où il croit aller.
  if (body.visibility === "private") {
    const { error } = await supabase
      .from("published_gents")
      .update({ visibility: "private", published_at: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, visibility: "private" });
  }

  const espace = acces.value.row.espace as { name?: string } | null;
  const demande = toSlug(body.slug?.trim() || espace?.name || params.id);

  const probleme = slugProbleme(demande);
  if (probleme) return NextResponse.json({ error: slugMessage(probleme) }, { status: 400 });

  // Le slug déjà attribué à CE gent reste le sien : republier ne doit pas le
  // faire glisser en « -2 » et casser une adresse déjà diffusée.
  const actuel = (acces.value.row.public_slug as string | null) ?? null;
  let slug = demande;
  if (demande !== actuel) {
    const { data: pris } = await supabase
      .from("published_gents")
      .select("public_slug")
      .not("public_slug", "is", null)
      .neq("id", params.id);
    slug = slugSuivant(
      demande,
      (pris ?? []).map((r) => r.public_slug as string)
    );
  }

  const { error } = await supabase
    .from("published_gents")
    .update({
      visibility: "public",
      public_slug: slug,
      published_at: new Date().toISOString(),
      directory_summary: (body.summary ?? "").trim().slice(0, 280) || null,
      public_chat: !!body.publicChat,
    })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // `slugAjuste` prévient l'interface que l'adresse demandée était prise :
  // la changer en silence laisserait le créateur diffuser une adresse qu'il
  // croit être la sienne.
  return NextResponse.json({ ok: true, visibility: "public", slug, slugAjuste: slug !== demande });
}
