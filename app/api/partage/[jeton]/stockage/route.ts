import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decisionAcces } from "@/lib/server/accesPartage";
import { nomCookie } from "@/lib/accesCode";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { debitAdmis, lireDemandeStockage, MESSAGE_STOCKAGE } from "@/lib/stockagePage";
import { operationStockage } from "@/lib/server/stockagePages";

export const dynamic = "force-dynamic";

/** Écritures récentes par lien, pour le débit (au mieux, par instance). */
const ecritures = new Map<string, number[]>();

/**
 * Stockage PARTAGÉ d'une page, pour le lecteur d'un lien : `window.storage`
 * avec `shared` vrai. Le document isolé ne peut rien appeler lui-même : il
 * passe par la page du lien (`useStockagePartage`), qui appelle ici avec ses
 * cookies — les MÊMES gardes que le document : lien valide, code validé si la
 * page est protégée. Commun à tous les liens de la page.
 */
export async function POST(req: Request, props: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await props.params;
  const a = await lireArtefact(jeton);
  if (!a) return NextResponse.json({ error: "Ce lien n'existe pas ou a expiré." }, { status: 404 });
  if ((await decisionAcces(a, (await cookies()).get(nomCookie(a.jeton))?.value)) !== "ouvert")
    return NextResponse.json({ error: "Accès protégé : validez votre code." }, { status: 403 });
  if (!a.pageId) return NextResponse.json({ error: "Le stockage partagé n'est pas disponible pour ce lien." }, { status: 409 });

  const d = lireDemandeStockage(await req.json().catch(() => null));
  if (typeof d === "string") return NextResponse.json({ error: MESSAGE_STOCKAGE[d] }, { status: 400 });
  if (d.op === "set" || d.op === "delete") {
    const { admis, restants } = debitAdmis(ecritures.get(jeton) ?? [], Date.now());
    ecritures.set(jeton, restants);
    if (!admis) return NextResponse.json({ error: MESSAGE_STOCKAGE.debit }, { status: 429 });
  }
  const r = await operationStockage(a.pageId, d);
  if (!r.ok)
    return NextResponse.json(
      { error: r.refus === "indisponible" ? "Le stockage de cette page est momentanément indisponible." : MESSAGE_STOCKAGE[r.refus] },
      { status: r.refus === "indisponible" ? 503 : 400 }
    );
  return NextResponse.json({ resultat: r.resultat }, { headers: { "Cache-Control": "no-store" } });
}
