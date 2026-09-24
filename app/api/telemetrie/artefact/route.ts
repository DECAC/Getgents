import { NextResponse } from "next/server";
import { TAILLE_MAX_MESURE, creerPlafond, validerMesureArtefact } from "@/lib/telemetrieArtefact";

export const dynamic = "force-dynamic";

/**
 * Reçoit un événement de mesure et l'écrit dans les journaux, sous
 * l'étiquette `getgents:artefact` — voir lib/telemetrieArtefact.ts.
 *
 * Route PUBLIQUE : les visiteurs d'un lien n'ont pas de compte, et c'est
 * justement leur usage qu'on veut mesurer. Elle n'écrit rien en base et
 * n'appelle aucun modèle — le pire qu'on puisse y faire est d'ajouter des
 * lignes de journal, chacune bornée à des valeurs énumérées — et plafonnées
 * par adresse.
 */
const autoriser = creerPlafond();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  if (!autoriser(ip)) return new NextResponse(null, { status: 429 });
  const texte = await req.text().catch(() => "");
  if (!texte || texte.length > TAILLE_MAX_MESURE) return new NextResponse(null, { status: 400 });
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const mesure = validerMesureArtefact(brut);
  if (!mesure) return new NextResponse(null, { status: 400 });
  console.info(JSON.stringify({ tag: "getgents:artefact", ...mesure }));
  return new NextResponse(null, { status: 204 });
}
