import { NextResponse } from "next/server";
import { enregistrerFichier, lireMaVoix, lireProjet } from "@/lib/server/publicisteProjets";
import { auteurPubliciste, idValide, refusPubliciste } from "@/lib/server/routePubliciste";
import { voixGemini } from "@/lib/server/gemini";
import { voixRecomposee } from "@/lib/server/mistral";
import { voixAutorisee } from "@/lib/server/limiteVoix";
import { MA_VOIX, TEXTE_ESSAI_MAX, VOIX_GEMINI, nomFichierVoix, promptVoixGemini, texteSansSuspension } from "@/lib/publicisteDirection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Publiciste, lot 3 : UNE voix lit le texte d'essai. Les six voix Gemini
 * reçoivent la consigne de la maquette ; « Ma voix » est recomposée par
 * Mistral à partir de l'enregistrement de l'auteur. Clés de la PLATEFORME
 * (lib/server/gemini.ts, lib/server/mistral.ts), plafond horaire par compte.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await auteurPubliciste();
  if ("refus" in a) return a.refus;
  const { id } = await params;
  if (!idValide(id)) return NextResponse.json({ error: "id_invalide" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const voix = typeof body?.voix === "string" ? body.voix : "";
  const gemini = VOIX_GEMINI.find((v) => v.id === voix);
  if (!gemini && voix !== MA_VOIX) return NextResponse.json({ error: "voix_inconnue" }, { status: 400 });
  const texte = typeof body?.texte === "string" ? body.texte.replace(/\s+/g, " ").trim().slice(0, TEXTE_ESSAI_MAX) : "";
  if (texte.length < 3) return NextResponse.json({ error: "texte_vide", message: "Écrivez d'abord le texte à faire lire." }, { status: 400 });

  const projet = await lireProjet(a.userId, id);
  if (!projet.ok) return refusPubliciste(projet.cause);
  if (!voixAutorisee(a.userId)) {
    return NextResponse.json({ error: "plafond", message: "Beaucoup de voix générées en une heure : réessayez un peu plus tard." }, { status: 429 });
  }

  let wav: Uint8Array;
  if (gemini) {
    const r = await voixGemini(promptVoixGemini(texte), gemini.nom);
    console.log(JSON.stringify({ tag: "getgents:publiciste", event: "voix", voix, ok: r.ok, ...(r.ok ? { modele: r.modele } : { cause: r.cause }) }));
    if (!r.ok) {
      const message = r.cause === "gemini_non_configure" ? "Les voix Gemini ne sont pas configurées sur ce serveur." : `La voix n'a pas pu être générée (réf. ${r.cause}). Réessayez.`;
      return NextResponse.json({ error: "voix_echec", message }, { status: r.statut });
    }
    wav = r.wav;
  } else {
    const ref = await lireMaVoix(a.userId);
    if (!ref.ok) return refusPubliciste(ref.cause);
    if (!ref.octets) return NextResponse.json({ error: "sans_reference", message: "Enregistrez d'abord votre voix." }, { status: 409 });
    const r = await voixRecomposee(texteSansSuspension(texte), ref.octets);
    console.log(JSON.stringify({ tag: "getgents:publiciste", event: "ma_voix", ok: r.ok, ...(r.ok ? {} : { cause: r.cause }) }));
    if (!r.ok) {
      const message = r.cause === "mistral_non_configure" ? "La recomposition de voix n'est pas configurée sur ce serveur." : `Votre voix n'a pas pu être recomposée (réf. ${r.cause}). Réessayez.`;
      return NextResponse.json({ error: "voix_echec", message }, { status: r.statut });
    }
    wav = r.wav;
  }
  const nom = nomFichierVoix(voix);
  const e = await enregistrerFichier(a.userId, id, nom, "audio/wav", wav, 0);
  if (!e.ok) return refusPubliciste(e.cause);
  return NextResponse.json({ nom, texte });
}
