import { cookies } from "next/headers";
import { decisionAcces } from "@/lib/server/accesPartage";
import { nomCookie } from "@/lib/accesCode";
import { NextResponse } from "next/server";
import { compterQuestion, lireArtefact } from "@/lib/server/artefactsPartages";
import { consigneAssistant, historiqueValide, QUESTIONS_MAX_PAR_LIEN, REPONSE_MAX_TOKENS } from "@/lib/assistantDocument";
import { chatResponseFor } from "@/lib/server/chatEngine";
import { contexteForUser } from "@/lib/server/openRouterKey";
import { consommerPourVisiteur } from "@/lib/server/gentGuard";
import { modeleConversationEffectif } from "@/lib/modeleConversation";
import { contenuLigneSse, sansMarqueur } from "@/lib/activitePage";
import { enregistrerQuestion, marquerQuestion } from "@/lib/server/activitePages";
import { getUser } from "@/lib/server/session";
import { complementsDeLaPage } from "@/lib/server/complementsPages";

/**
 * Laisse passer le flux tel quel, en lisant au passage le DÉBUT de la
 * réponse : le marqueur « hors page » dit que l'information manquait. La
 * question est marquée avant la fin du flux (flush), pour que la fonction ne
 * soit pas arrêtée entre les deux.
 */
function avecSuivi(corps: ReadableStream<Uint8Array>, questionId: string): ReadableStream<Uint8Array> {
  const lecteur = new TextDecoder();
  let reste = "";
  let debut = "";
  return corps.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(morceau, sortie) {
        sortie.enqueue(morceau);
        if (debut.length > 60) return;
        reste += lecteur.decode(morceau, { stream: true });
        const lignes = reste.split("\n");
        reste = lignes.pop() ?? "";
        for (const l of lignes) debut += contenuLigneSse(l);
      },
      async flush() {
        if (reste) debut += contenuLigneSse(reste);
        if (!debut.trim()) return;
        await marquerQuestion(questionId, sansMarqueur(debut).horsPage).catch((e) =>
          console.error(JSON.stringify({ tag: "getgents:activite", event: "question_non_marquee", detail: (e as Error).message }))
        );
      },
    })
  );
}

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
  // Page protégée par code : sans cookie d'accès valide, rien ne sort.
  if ((await decisionAcces(a, cookies().get(nomCookie(a.jeton))?.value)) !== "ouvert")
    return NextResponse.json({ error: "Accès protégé : validez votre code." }, { status: 403 });
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
  // Précisions de l'auteur : lues avec la page, invisibles comme telles pour le visiteur.
  const complements = await complementsDeLaPage(a.pageId).catch((e) => {
    console.error(JSON.stringify({ tag: "getgents:activite", event: "complements_illisibles", detail: (e as Error).message }));
    return [];
  });
  const consigne = consigneAssistant({
    complements,
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
      complements: complements.length,
      historique: historique.length,
      modele,
    })
  );

  // La question est gardée pour l'auteur, SANS nom ni lien (page et jour
  // seulement). Les essais de l'auteur sur sa propre page ne comptent pas.
  let questionId: string | null = null;
  const moi = await getUser();
  if (!moi || moi.id !== a.ownerId) {
    questionId = await enregistrerQuestion(a.pageId, historique[historique.length - 1].content).catch((e) => {
      console.error(JSON.stringify({ tag: "getgents:activite", event: "question_non_enregistree", detail: (e as Error).message }));
      return null;
    });
  }

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
  return new Response(questionId ? avecSuivi(amont.body, questionId) : amont.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
