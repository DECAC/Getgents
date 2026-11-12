import { NextResponse } from "next/server";
import { compterQuestion, lireArtefact } from "@/lib/server/artefactsPartages";
import { consigneAssistant, historiqueValide, QUESTIONS_MAX_PAR_LIEN, REPONSE_MAX_TOKENS } from "@/lib/assistantDocument";
import { chatResponseFor } from "@/lib/server/chatEngine";
import { contexteForUser } from "@/lib/server/openRouterKey";
import { consommerPourVisiteur } from "@/lib/server/gentGuard";
import { modeleConversationEffectif } from "@/lib/modeleConversation";

/**
 * Assistant du document d'un artefact partagé. Le destinataire n'a pas de
 * compte : le JETON du lien fait l'accès, comme pour le document lui-même,
 * et l'option doit avoir été activée par le propriétaire.
 *
 * C'est le PROPRIÉTAIRE qui paie (sa clé personnelle, sinon son quota sur la
 * clé commune), et chaque lien est plafonné à QUESTIONS_MAX_PAR_LIEN : un
 * lien qui circule ne vide pas sa clé. Aucun outil, aucune recherche : le
 * modèle ne lit que le document.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Le destinataire n'a jamais vu de « gent » : le message générique des liens ne lui parlerait pas.
const INDISPONIBLE = "L'assistant est momentanément indisponible. Le document reste consultable ; réessayez plus tard.";

export async function POST(req: Request, { params }: { params: { jeton: string } }) {
  const a = await lireArtefact(params.jeton);
  if (!a) return NextResponse.json({ error: "Ce lien n'existe pas ou a expiré." }, { status: 404 });
  if (!a.assistant || !a.ownerId) return NextResponse.json({ error: "L'assistant n'est pas activé sur ce document." }, { status: 403 });

  const corps = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const historique = historiqueValide(corps.messages);
  if (!historique) return NextResponse.json({ error: "Question vide." }, { status: 400 });

  const ctx = await contexteForUser(a.ownerId);
  if (!ctx.cle) return NextResponse.json({ error: INDISPONIBLE }, { status: 503 });
  const quota = await consommerPourVisiteur(ctx, "llm");
  if (!quota.ok) return NextResponse.json({ error: INDISPONIBLE }, { status: 429 });
  if (!(await compterQuestion(a.jeton, QUESTIONS_MAX_PAR_LIEN)))
    return NextResponse.json(
      { error: "L'assistant a répondu au nombre maximal de questions pour ce document. Posez vos questions à la personne qui vous l'a partagé." },
      { status: 429 }
    );

  const modele = modeleConversationEffectif(undefined).id;
  const consigne = consigneAssistant({
    titre: a.titre,
    format: a.format,
    contenu: a.contenu,
    dateFigee: new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }),
  });
  console.log(
    JSON.stringify({
      tag: "getgents:partage",
      event: "assistant_question",
      ownerId: a.ownerId,
      questions: a.questions + 1,
      consigneCaracteres: consigne.length,
      historique: historique.length,
      modele,
    })
  );

  const amont = await chatResponseFor(
    { model: modele, messages: [{ role: "system", content: consigne }, ...historique], stream: true, max_tokens: REPONSE_MAX_TOKENS },
    ctx,
    "partage-assistant"
  );
  if (!amont.ok || !amont.body) {
    const detail = await amont.text().catch(() => "");
    console.error(JSON.stringify({ tag: "getgents:partage", event: "assistant_echec", status: amont.status, detail: detail.slice(0, 300) }));
    return NextResponse.json({ error: "L'assistant n'a pas pu répondre. Réessayez dans un instant." }, { status: 502 });
  }
  return new Response(amont.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
