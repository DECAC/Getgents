import { NextResponse } from "next/server";
import { ecrireProjet, lireProjet, renommerProjet, supprimerProjet } from "@/lib/server/publicisteProjets";
import { auteurPubliciste, idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { validerEtat, validerNom } from "@/lib/publiciste";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Un projet du Publiciste : lu, enregistré (écriture conditionnelle), renommé, supprimé — par son auteur seul. */
export async function GET(_req: Request, { params }: Ctx) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const r = await lireProjet(a.userId, id);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ nom: r.nom, etat: r.etat, version: r.version });
}

export async function PUT(req: Request, { params }: Ctx) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const etat = validerEtat(body?.etat);
  if (!etat) return NextResponse.json({ error: "etat_invalide" }, { status: 400 });
  const version = body?.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return NextResponse.json({ error: "version_invalide" }, { status: 400 });
  const r = await ecrireProjet(a.userId, id, etat, version);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ version: r.version });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const nom = validerNom(body?.nom);
  if (nom === null) return NextResponse.json({ error: "nom_invalide" }, { status: 400 });
  const r = await renommerProjet(a.userId, id, nom);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ nom });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const r = await supprimerProjet(a.userId, id);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ supprime: true });
}
