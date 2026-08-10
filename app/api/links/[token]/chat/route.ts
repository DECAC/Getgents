import { NextResponse } from "next/server";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { describeShareLinksFailure, getShareLink, recordShareEvent, TOKEN_RE } from "@/lib/server/shareLinks";
import { canChat } from "@/lib/shareLink";
import { CHAT_MAX_TOKENS } from "@/lib/streamChat";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import type { Espace } from "@/lib/types";

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
  const systemPrompt = buildGentSystemPrompt(espace, { variant: "sharedLink" });

  await recordShareEvent(token, "chat", link.targetLabel);

  // Relais serveur-à-serveur vers /api/chat : même origine, flux SSE retransmis.
  const origin = new URL(req.url).origin;
  const upstream = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-getgents-source": "share-link" },
    body: JSON.stringify({
      model: espace.chatModelId ?? "anthropic/claude-sonnet-5",
      messages: [{ role: "system", content: systemPrompt }, ...history],
      stream: true,
      // Même plafond que l'espace : sans lui, le relais laissait la valeur par
      // défaut du fournisseur, bien plus haute — une réponse déjà trop longue
      // n'était même pas bornée.
      max_tokens: CHAT_MAX_TOKENS.espace,
      reasoning: { enabled: true },
      mcpServers: espace.mcpServers,
      datasets: espace.datasets,
      prim: espace.prim,
      powens: espace.powens,
      gmail: espace.gmail,
      gentId: link.gentId,
      restApis: espace.restApis,
      webSearch: espace.webSearch,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "upstream_error", detail: detail.slice(0, 300) },
      { status: upstream.status || 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
