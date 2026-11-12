import { NextResponse } from "next/server";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { decisionAcces, envoyerCode } from "@/lib/server/accesPartage";

/**
 * Envoie un code d'accès au destinataire d'un lien protégé. Le jeton du lien
 * fait l'accès ; le code part à l'adresse ENREGISTRÉE — jamais à une adresse
 * fournie par l'appelant. Renvoi limité (60 s) et envois plafonnés par lien.
 */
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { jeton: string } }) {
  const a = await lireArtefact(params.jeton);
  if (!a) return NextResponse.json({ error: "Ce lien n'existe pas ou a expiré." }, { status: 404 });
  const d = await decisionAcces(a, undefined);
  if (d === "ouvert") return NextResponse.json({ error: "Cette page n'est pas protégée." }, { status: 400 });
  if (d === "indisponible") return NextResponse.json({ error: "Service momentanément indisponible. Réessayez." }, { status: 503 });
  try {
    const r = await envoyerCode(a);
    return r.ok ? NextResponse.json({ masque: r.masque }) : NextResponse.json({ error: r.erreur }, { status: r.status });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:acces", event: "envoi_echoue", detail: (e as Error).message }));
    return NextResponse.json({ error: "Le code n'a pas pu être envoyé. Réessayez." }, { status: 500 });
  }
}
