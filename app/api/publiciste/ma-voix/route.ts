import { NextResponse } from "next/server";
import { enregistrerMaVoix, lireMaVoix, supprimerMaVoix } from "@/lib/server/publicisteProjets";
import { auteurPubliciste, refusPubliciste } from "@/lib/server/routePubliciste";
import { ACCORD_MA_VOIX, dureeWav } from "@/lib/publicisteDirection";

export const dynamic = "force-dynamic";

/**
 * « Ma voix » : l'enregistrement de référence de l'auteur (WAV mono, 30 s au
 * plus — Mistral refuse au-delà ; le navigateur le coupe et le convertit).
 * Un par compte, pour SES projets seulement. POST exige l'accord coché ;
 * DELETE l'efface.
 */
const OCTETS_MAX = 3_500_000;

export async function GET() {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const r = await lireMaVoix(a.userId);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ presente: !!r.octets, le: r.le, duree: r.octets ? dureeWav(r.octets) : null });
}

export async function POST(req: Request) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  if (req.headers.get("x-accord-ma-voix") !== "oui") {
    return NextResponse.json({ error: "accord_requis", message: "Confirmez d'abord que c'est votre voix." }, { status: 400 });
  }
  const octets = new Uint8Array(await req.arrayBuffer().catch(() => new ArrayBuffer(0)));
  if (octets.length > OCTETS_MAX) return NextResponse.json({ error: "trop_lourd", message: "Enregistrement trop long : 30 secondes au plus." }, { status: 413 });
  const duree = dureeWav(octets);
  if (duree == null) return NextResponse.json({ error: "format", message: "L'enregistrement n'est pas lisible. Réessayez." }, { status: 400 });
  if (duree < 5) return NextResponse.json({ error: "trop_court", message: "Enregistrement trop court : visez 30 secondes, en lisant tout le texte." }, { status: 400 });
  if (duree > 30) return NextResponse.json({ error: "trop_long", message: "Enregistrement trop long : 30 secondes au plus." }, { status: 400 });
  const r = await enregistrerMaVoix(a.userId, octets, ACCORD_MA_VOIX);
  if (!r.ok) return refusPubliciste(r.cause);
  console.log(JSON.stringify({ tag: "getgents:publiciste", event: "ma_voix_enregistree", duree: Math.round(duree * 10) / 10 }));
  return NextResponse.json({ presente: true, le: r.le, duree });
}

export async function DELETE() {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const r = await supprimerMaVoix(a.userId);
  if (!r.ok) return refusPubliciste(r.cause);
  return NextResponse.json({ presente: false });
}
