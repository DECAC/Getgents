import { NextResponse } from "next/server";
import { lireFichier } from "@/lib/server/publicisteProjets";
import { auteurPubliciste, idValide, refusPubliciste } from "@/lib/server/routePubliciste";

export const dynamic = "force-dynamic";

/** Un fichier généré d'un projet (planche…), pour son auteur seul : adresse signée d'une heure. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; nom: string }> }) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id, nom } = await params;
  if (!idValide(id) || !/^[a-z0-9-]{1,90}$/.test(nom)) return NextResponse.json({ error: "adresse_invalide" }, { status: 400 });
  const r = await lireFichier(a.userId, id, nom);
  if (!r.ok) return refusPubliciste(r.cause);
  if ("adresse" in r) return NextResponse.redirect(r.adresse, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
  return new Response(r.octets as unknown as BodyInit, { headers: { "Content-Type": r.type, "Cache-Control": "private, max-age=300" } });
}
