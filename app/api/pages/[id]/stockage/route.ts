import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { lireDemandeStockage, MESSAGE_STOCKAGE } from "@/lib/stockagePage";
import { operationStockage, resumeStockage, viderStockage } from "@/lib/server/stockagePages";

export const dynamic = "force-dynamic";

/**
 * Stockage partagé d'une page, côté PROPRIÉTAIRE : l'aperçu de la fiche s'en
 * sert comme un lecteur (POST), la fiche en montre le résumé (GET) et le
 * remet à zéro (DELETE). Filtré sur le propriétaire : 404 sinon.
 */
async function pageDuCompte(id: string) {
  const auth = await requireUser();
  if ("response" in auth) return { reponse: auth.response };
  const page = await lirePage(auth.user.id, id).catch(() => null);
  if (!page) return { reponse: NextResponse.json({ error: "Page introuvable." }, { status: 404 }) };
  return { page };
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  const resume = await resumeStockage(r.page.id);
  return NextResponse.json({ resume }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  const d = lireDemandeStockage(await req.json().catch(() => null));
  if (typeof d === "string") return NextResponse.json({ error: MESSAGE_STOCKAGE[d] }, { status: 400 });
  const res = await operationStockage(r.page.id, d);
  if (!res.ok)
    return NextResponse.json(
      { error: res.refus === "indisponible" ? "Le stockage de cette page est momentanément indisponible." : MESSAGE_STOCKAGE[res.refus] },
      { status: res.refus === "indisponible" ? 503 : 400 }
    );
  return NextResponse.json({ resultat: res.resultat }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  const ok = await viderStockage(r.page.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Les données n'ont pas pu être effacées." }, { status: 503 });
}
