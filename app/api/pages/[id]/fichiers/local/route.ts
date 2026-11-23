import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { MESSAGE_FICHIER, validerFichier } from "@/lib/fichiersPage";
import { envoiLocal, listerFichiers } from "@/lib/server/fichiersPages";

export const dynamic = "force-dynamic";

/**
 * DÉVELOPPEMENT sans Supabase seulement : le fichier passe par l'application
 * (en production, il part directement dans Supabase Storage). 404 ailleurs.
 */
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production" || getSupabaseAdmin()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const page = await lirePage(auth.user.id, params.id).catch(() => null);
  if (!page) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const u = new URL(req.url);
  const nom = u.searchParams.get("nom") ?? "";
  const chemin = u.searchParams.get("chemin") ?? "";
  const type = req.headers.get("content-type") ?? "";
  const donnees = Buffer.from(await req.arrayBuffer());
  const refus = validerFichier({ nom, type, taille: donnees.length }, await listerFichiers(page.id));
  if (refus) return NextResponse.json({ error: MESSAGE_FICHIER[refus] }, { status: 400 });
  if (!chemin.startsWith(`${page.id}/`)) return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  envoiLocal(page.id, chemin, { nom, type }, donnees);
  return NextResponse.json({ ok: true });
}
