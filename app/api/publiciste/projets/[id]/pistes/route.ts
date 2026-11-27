import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { lireProjet } from "@/lib/server/publicisteProjets";
import { proposerPistes } from "@/lib/server/publicisteDirection";
import { idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { ETAPES_DIRECTION, POLICES, type ChoixPrecedents, type EtapeDirection } from "@/lib/publicisteDirection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publiciste, lot 2 : les trois pistes d'une étape de direction (visuel,
 * typo, couleurs), d'après la fiche de l'entretien et les choix déjà faits.
 * Rien n'est écrit ici : le navigateur range la proposition dans le projet.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const etape = body?.etape as EtapeDirection;
  if (!ETAPES_DIRECTION.includes(etape)) return NextResponse.json({ error: "etape_invalide" }, { status: 400 });
  const remarque = typeof body?.remarque === "string" ? body.remarque.trim().slice(0, 500) : "";

  const projet = await lireProjet(garde.value.user.id, id);
  if (!projet.ok) return refusPubliciste(projet.cause);
  const { etat } = projet;
  const avant: ChoixPrecedents = {};
  const v = etat.direction?.visuel?.visuel?.find((p) => p.id === etat.choix.visuel);
  if (v && etape !== "visuel") avant.visuel = { nom: v.nom, desc: v.desc };
  const t = POLICES.find((p) => p.id === etat.choix.typo);
  if (t && etape === "couleurs") avant.typo = { nom: t.nom, detail: t.detail };

  const r = await proposerPistes(garde.value.ctx, etape, etat.fiche, avant, remarque || undefined);
  if (!r.ok) return NextResponse.json({ error: "pistes_echec", message: r.erreur }, { status: r.statut });
  return NextResponse.json({ proposition: r.proposition, cout: r.cout });
}
