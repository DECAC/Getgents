import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { enregistrerFichier, lireProjet } from "@/lib/server/publicisteProjets";
import { genererExtraitMusique } from "@/lib/server/publicisteDirection";
import { idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { nomFichierMusique, promptMusique } from "@/lib/publicisteDirection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publiciste, lot 3 : UN extrait de musique de 30 s (une piste). La page en
 * lance trois ensemble, comme les planches. La demande vient de la page
 * (comme le prompt d'une planche) : la proposition vient d'arriver et n'est
 * peut-être pas encore enregistrée dans le projet.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const pisteId = typeof body?.piste === "string" && /^[a-z0-9-]{1,40}$/.test(body.piste) ? body.piste : null;
  const demande = typeof body?.demande === "string" ? body.demande.trim().slice(0, 600) : "";
  const ressenti = typeof body?.ressenti === "string" ? body.ressenti.trim().slice(0, 400) : "";
  if (!pisteId || !demande) return NextResponse.json({ error: "piste_invalide" }, { status: 400 });

  const owner = garde.value.user.id;
  const projet = await lireProjet(owner, id);
  if (!projet.ok) return refusPubliciste(projet.cause);

  const r = await genererExtraitMusique(garde.value.ctx, promptMusique({ demande, ressenti }));
  if (!r.ok) return NextResponse.json({ error: "musique_echec", message: r.erreur }, { status: r.statut });
  const nom = nomFichierMusique(pisteId);
  const e = await enregistrerFichier(owner, id, nom, "audio/mpeg", r.octets, r.cout);
  if (!e.ok) return refusPubliciste(e.cause);
  return NextResponse.json({ nom, cout: r.cout });
}
