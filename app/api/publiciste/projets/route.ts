import { NextResponse } from "next/server";
import { creerProjet, listerProjets } from "@/lib/server/publicisteProjets";
import { auteurPubliciste, gentValide, refusPubliciste } from "@/lib/server/routePubliciste";

export const dynamic = "force-dynamic";

/** « Vos projets » : la liste des projets de l'auteur pour ce gent, et la création d'un projet. */
export async function GET(req: Request) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const gent = new URL(req.url).searchParams.get("gent");
  if (!gentValide(gent)) return NextResponse.json({ error: "gent_invalide" }, { status: 400 });
  const r = await listerProjets(a.userId, gent);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ projets: r.projets });
}

export async function POST(req: Request) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const body = await req.json().catch(() => null);
  if (!gentValide(body?.gent)) return NextResponse.json({ error: "gent_invalide" }, { status: 400 });
  const r = await creerProjet(a.userId, body.gent);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ id: r.id });
}
