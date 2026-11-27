import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { refusOffrePages } from "@/lib/server/offre";
import { compterPhrase, direTexte, mistralConfigure, PLAFOND_PHRASES_PAR_HEURE } from "@/lib/server/mistral";
import { TEXTE_VOIX_MAX } from "@/lib/publiciste";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Gent « Le Publiciste » : fait dire UNE phrase de la voix off par une voix
 * Mistral et rend le WAV. Un appel court par scène, enchaînés par
 * l'atelier : jamais de génération longue dans une seule fonction (Vercel
 * coupe à 300 s). Réservé aux comptes complets ; payé par la plateforme.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const horsOffre = refusOffrePages(auth.user.id);
  if (horsOffre) return horsOffre;
  if (!mistralConfigure()) {
    return NextResponse.json({ error: "mistral_non_configure", message: "La voix n'est pas encore branchée sur ce serveur (clé Mistral absente)." }, { status: 503 });
  }

  let body: { texte?: unknown; voix?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const texte = typeof body.texte === "string" ? body.texte.slice(0, TEXTE_VOIX_MAX) : "";
  const voix = typeof body.voix === "string" ? body.voix : "";
  if (!texte.trim()) return NextResponse.json({ error: "texte_vide" }, { status: 400 });

  if (!compterPhrase(auth.user.id)) {
    return NextResponse.json(
      { error: "plafond", message: `Plafond atteint : ${PLAFOND_PHRASES_PAR_HEURE} phrases par heure. Réessayez dans l'heure.` },
      { status: 429 }
    );
  }

  const debut = Date.now();
  const r = await direTexte(texte, voix);
  if (!r.ok) {
    console.error(JSON.stringify({ tag: "getgents:publiciste", event: "voix_echec", statut: r.statut, cause: r.cause, voix }));
    const message = r.statut === 400 ? "Texte ou voix refusé." : "La voix n'a pas pu être générée. Réessayez dans un instant.";
    return NextResponse.json({ error: "voix_echec", message }, { status: r.statut >= 500 || r.statut === 429 ? r.statut : 502 });
  }
  console.log(JSON.stringify({ tag: "getgents:publiciste", event: "voix_generee", voix, caracteres: texte.length, ms: Date.now() - debut }));
  return new Response(r.wav as unknown as BodyInit, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
}
