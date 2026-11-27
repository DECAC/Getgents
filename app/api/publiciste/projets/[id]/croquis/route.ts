import { NextResponse } from "next/server";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { enregistrerFichier, lireProjet } from "@/lib/server/publicisteProjets";
import { genererPlanche } from "@/lib/server/publicisteDirection";
import { idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { FORMAT_CROQUIS, MODELE_CROQUIS, nomFichierCroquis, promptCroquis } from "@/lib/publicisteStoryboard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Publiciste, lot 4 : le croquis d'UNE scène (9:16, crayon). La page en lance plusieurs à la fois. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await requireUserWithQuota("image");
  if (!garde.ok) return garde.response;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const scene = typeof body?.scene === "string" && /^s[a-z0-9]{1,12}$/.test(body.scene) ? body.scene : null;
  const voit = typeof body?.voit === "string" ? body.voit.trim().slice(0, 600) : "";
  const univers = typeof body?.univers === "string" ? body.univers.trim().slice(0, 400) : "";
  if (!scene || !voit) return NextResponse.json({ error: "scene_invalide" }, { status: 400 });

  const owner = garde.value.user.id;
  const projet = await lireProjet(owner, id);
  if (!projet.ok) return refusPubliciste(projet.cause);
  const r = await genererPlanche(garde.value.ctx, promptCroquis(voit, univers || undefined), MODELE_CROQUIS, FORMAT_CROQUIS);
  if (!r.ok) return NextResponse.json({ error: "croquis_echec", message: r.erreur }, { status: r.statut });
  const nom = nomFichierCroquis(scene);
  const e = await enregistrerFichier(owner, id, nom, r.type, r.octets, r.cout);
  if (!e.ok) return refusPubliciste(e.cause);
  return NextResponse.json({ nom, cout: r.cout });
}
