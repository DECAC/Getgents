import { NextResponse } from "next/server";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { describeShareLinksFailure, getShareLink, recordShareEvent, TOKEN_RE } from "@/lib/server/shareLinks";
import { canChat } from "@/lib/shareLink";
import { CHAT_MAX_TOKENS } from "@/lib/streamChat";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { supportsReasoningStream } from "@/lib/openRouterReasoning";
import type { Espace } from "@/lib/types";
import { chatResponseFor } from "@/lib/server/chatEngine";
import { contexteForGent } from "@/lib/server/openRouterKey";
import { consommerPourVisiteur } from "@/lib/server/gentGuard";
import { MESSAGE_VISITEUR_INDISPONIBLE } from "@/lib/openRouterKey";
import { notifierUsageInvite } from "@/lib/server/signalements";
import { langueDeLEnTete } from "@/lib/langue";
import { mesurerReponse, porteDuContenu, type InstantsReponse } from "@/lib/chatTiming";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Params {
  params: { token: string };
}

interface ClientMessage {
  role: string;
  content: string;
}

/**
 * Conversation d'un destinataire de lien de partage.
 *
 * Le navigateur du destinataire ne connaît ni le prompt système ni les
 * connecteurs : ils sont relus en base à partir du token et injectés ici. Tout
 * message `system` envoyé par le client est ignoré — il ne doit pas pouvoir
 * réécrire les instructions du gent.
 *
 * Le flux SSE de /api/chat est relayé tel quel, ce qui évite de dupliquer la
 * boucle d'outils (MCP, datasets, API REST) qui y est écrite.
 */
export async function POST(req: Request, { params }: Params) {
  const debutRequete = Date.now();
  const token = params.token;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let link;
  try {
    link = await getShareLink(token);
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
  if (!link) return NextResponse.json({ error: "link_not_found" }, { status: 404 });
  if (!canChat(link)) return NextResponse.json({ error: "link_unavailable" }, { status: 403 });

  let body: { messages?: ClientMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("published_gents")
    .select(DIFFUSED_COLUMNS)
    .eq("id", link.gentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Le destinataire d'un lien voit la version DIFFUSÉE, jamais la version de
  // travail que le créateur remue en Preview.
  const espace = diffusedEspace(data);
  if (!espace) return NextResponse.json({ error: "gent_not_found" }, { status: 404 });

  // On ne garde que l'échange utilisateur/assistant venant du client.
  const history = (body.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20);
  if (history.length === 0) return NextResponse.json({ error: "empty_messages" }, { status: 400 });

  // Même assemblage que l'espace du créateur : le gent répond de façon
  // identique en Preview et par un lien — mêmes garde-fous, même format
  // d'artefacts, et son prompt qui gouverne le style.
  // La langue du navigateur sert d'amorce au premier tour, avant que le
  // visiteur ait écrit ; ensuite la langue de son message prime (voir
  // lib/langue.ts). L'en-tête est déjà là, il n'y a rien à demander ni à
  // stocker — donc rien à faire accepter à qui que ce soit.
  const langueNavigateur = langueDeLEnTete(req.headers.get("accept-language"));
  const systemPrompt = buildGentSystemPrompt(espace, {
    variant: "sharedLink",
    langueNavigateur,
  });

  await recordShareEvent(token, "chat", link.targetLabel);

  // Notification d'usage : au plus une par lien et par jour, jamais une par
  // message (voir lib/server/signalements.ts). Volontairement PAS attendue —
  // une conversation ne doit pas patienter derrière un envoi d'e-mail, ni
  // échouer si la messagerie est en panne.
  void notifierUsageInvite({
    gentId: link.gentId,
    nomGent: espace.name,
    token,
    label: link.targetLabel,
  });

  // Appel DIRECT du moteur de conversation, sans repasser par HTTP.
  //
  // C'était auparavant un `fetch` vers `/api/chat` sur la même origine. Une
  // requête serveur-à-serveur ne porte aucun cookie, donc aucune session :
  // depuis que `/api/chat` exige un compte, ce relais aurait été refusé. Le
  // faire passer aurait demandé un secret interne — une variable de plus, un
  // secret de plus à faire fuir. L'appel direct règle le problème et
  // économise un aller-retour réseau sur chaque tour.
  //
  // Le droit d'accès est déjà établi plus haut, par le jeton du lien.
  // C'est le PROPRIÉTAIRE du gent qui paie ce tour — sa clé personnelle si
  // elle est enregistrée, la clé commune sinon — et c'est son quota qui est
  // décompté dans ce second cas. Sans cela, un gent partagé largement viderait
  // la clé de la plateforme au rythme de ses visiteurs.
  const ctx = await contexteForGent(link.gentId);
  if (!ctx.cle) {
    return NextResponse.json({ error: MESSAGE_VISITEUR_INDISPONIBLE }, { status: 503 });
  }
  const quota = await consommerPourVisiteur(ctx, "llm");
  if (!quota.ok) return quota.response;

  const chatModelId = espace.chatModelId ?? "anthropic/claude-sonnet-5";
  const raisonnement = supportsReasoningStream(chatModelId);
  const instants: InstantsReponse = { debut: debutRequete, enTetes: null, premierJeton: null, fin: null };

  const upstream = await chatResponseFor(
    {
      model: chatModelId,
      messages: [{ role: "system", content: systemPrompt }, ...history],
      stream: true,
      // Même plafond que l'espace : sans lui, le relais laissait la valeur par
      // défaut du fournisseur, bien plus haute — une réponse déjà trop longue
      // n'était même pas bornée.
      max_tokens: CHAT_MAX_TOKENS.espace,
      ...(raisonnement ? { reasoning: { enabled: true } } : {}),
      mcpServers: espace.mcpServers,
      datasets: espace.datasets,
      prim: espace.prim,
      powens: espace.powens,
      gmail: espace.gmail,
      gentId: link.gentId,
      restApis: espace.restApis,
      webSearch: espace.webSearch,
    },
    ctx,
    "share-link"
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");

    // Le détail complet part dans les journaux, jamais à l'écran : il contient
    // la réponse brute d'OpenRouter, qui peut nommer le modèle, le compte, ou
    // la raison exacte d'un refus de clé.
    console.error(
      JSON.stringify({
        tag: "getgents:chat",
        event: "lien_partage_upstream",
        status: upstream.status,
        gentId: link.gentId,
        model: chatModelId,
        detail: detail.slice(0, 300),
      })
    );

    // `chatResponseFor` a DÉJÀ produit un message lisible pour un refus de clé
    // (401/402/403) — voir messageCleOpenRouter. Ce relais l'écrasait par un
    // « upstream_error » qui n'apprend rien à personne : ni au visiteur, qui ne
    // sait pas quoi faire, ni au propriétaire, qui ne sait pas que son crédit
    // est épuisé. On le laisse passer tel quel.
    let message = "";
    try {
      const data = JSON.parse(detail) as { error?: unknown };
      if (typeof data.error === "string" && data.error.trim()) message = data.error;
      else if (
        data.error &&
        typeof (data.error as { message?: unknown }).message === "string"
      ) {
        message = (data.error as { message: string }).message;
      }
    } catch {
      // Corps non-JSON : on retombe sur un message générique.
    }

    return NextResponse.json(
      {
        error:
          message ||
          "Le gent n'a pas pu répondre. Réessayez dans quelques instants ; si cela persiste, prévenez la personne qui vous a partagé ce lien.",
      },
      { status: upstream.status || 502 }
    );
  }

  instants.enTetes = Date.now();

  /**
   * Le flux est traversé pour l'HORODATER, pas pour le modifier : chaque
   * fragment repart tel quel. On note le premier — le silence avant lui est
   * ce que le visiteur vit comme un temps de réflexion — puis la fin.
   *
   * Sans cette mesure, on ne peut pas distinguer un modèle lent d'un prompt
   * trop gros, d'un raisonnement coûteux ou d'une recherche web. Ce sont
   * quatre corrections différentes.
   */
  const source = upstream.body.getReader();
  // Décodeur dédié à l'INSPECTION : les octets repartent tels quels, jamais
  // ré-encodés — un fragment coupé au milieu d'un caractère resterait intact.
  const decodeur = new TextDecoder();
  const mesure = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await source.read();
      if (done) {
        instants.fin = Date.now();
        console.log(
          JSON.stringify(
            mesurerReponse(instants, {
              gentId: link.gentId,
              model: chatModelId,
              raisonnement,
              webSearch: !!espace.webSearch,
              systemChars: systemPrompt.length,
              historique: history.length,
              maxTokens: CHAT_MAX_TOKENS.espace,
            })
          )
        );
        controller.close();
        return;
      }
      // On ne retient QUE le premier fragment portant du texte. Les
      // événements de statut et les pings de la boucle d'outils partent
      // immédiatement : les horodater mesurerait notre propre ping.
      if (instants.premierJeton === null && porteDuContenu(decodeur.decode(value, { stream: true }))) {
        instants.premierJeton = Date.now();
      }
      controller.enqueue(value);
    },
    cancel(raison) {
      // Le visiteur a fermé l'onglet ou changé d'avis. On relâche la source :
      // sans cela la requête continuerait de couler chez le fournisseur, et
      // resterait facturée au propriétaire du gent.
      void source.cancel(raison);
    },
  });

  return new Response(mesure, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
