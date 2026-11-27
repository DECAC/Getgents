import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { enregistrerFichier, lireProjet } from "@/lib/server/publicisteProjets";
import { genererPlanche } from "@/lib/server/publicisteDirection";
import { idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { nomFichierPlanche, promptPlanche } from "@/lib/publicisteDirection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publiciste, lot 2 : UNE planche d'ambiance (une piste). La page en lance
 * trois en parallèle — trois appels courts plutôt qu'une génération longue.
 * La planche est rangée dans le seau privé du projet, avec son coût.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await requireUserWithQuota("image");
  if (!garde.ok) return garde.response;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const pisteId = typeof body?.piste === "string" && /^[a-z0-9-]{1,40}$/.test(body.piste) ? body.piste : null;
  const consigne = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1500) : "";
  if (!pisteId || !consigne) return NextResponse.json({ error: "piste_invalide" }, { status: 400 });

  const owner = garde.value.user.id;
  const projet = await lireProjet(owner, id);
  if (!projet.ok) return refusPubliciste(projet.cause);

  const r = await genererPlanche(garde.value.ctx, promptPlanche({ id: pisteId, nom: "", desc: "", pour: "", contre: "", prompt: consigne }));
  if (!r.ok) return NextResponse.json({ error: "planche_echec", message: r.erreur }, { status: r.statut });
  const nom = nomFichierPlanche(pisteId);
  const e = await enregistrerFichier(owner, id, nom, r.type, r.octets, r.cout);
  if (!e.ok) return refusPubliciste(e.cause);
  return NextResponse.json({ nom, cout: r.cout });
}
