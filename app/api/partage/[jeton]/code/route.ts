import { NextResponse } from "next/server";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { decisionAcces, envoyerCode } from "@/lib/server/accesPartage";

/**
 * Envoie un code d'accès au destinataire d'un lien protégé. Le jeton du lien
 * fait l'accès ; le code part à l'adresse ENREGISTRÉE — jamais à une adresse
 * fournie par l'appelant. Renvoi limité (60 s) et envois plafonnés par lien.
 *
 * CHAQUE refus est journalisé (`getgents:acces code_refuse`) et porte une
 * `cause` courte affichée au visiteur : un premier essai réel a échoué sans
 * aucune trace exploitable. Jamais l'adresse ni le code dans le journal.
 */
export const dynamic = "force-dynamic";

function refus(status: number, error: string, cause: string, detail?: string) {
  console.error(JSON.stringify({ tag: "getgents:acces", event: "code_refuse", status, cause, detail }));
  return NextResponse.json({ error, cause }, { status });
}

export async function POST(_req: Request, { params }: { params: { jeton: string } }) {
  try {
    const a = await lireArtefact(params.jeton);
    if (!a) return refus(404, "Ce lien n'existe pas ou a expiré.", "lien-introuvable");
    const d = await decisionAcces(a, undefined);
    if (d === "ouvert") return refus(400, "Cette page n'est pas protégée.", "non-protegee");
    if (d === "indisponible") return refus(503, "Service momentanément indisponible. Réessayez.", "protection-illisible");
    const r = await envoyerCode(a);
    if (r.ok) return NextResponse.json({ masque: r.masque });
    return refus(r.status, r.erreur, r.cause ?? `refus-${r.status}`);
  } catch (e) {
    return refus(500, "Le code n'a pas pu être envoyé. Réessayez.", "exception", (e as Error).message);
  }
}
