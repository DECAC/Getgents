import { NextRequest, NextResponse } from "next/server";
import { McpClient, type McpTool } from "@/lib/server/mcp";

// Surchargeable en test/dev pour pointer vers un mock local.
const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOOL_ROUNDS = 6;
const TOOL_RESULT_MAX_CHARS = 12_000;

interface ChatBody {
  model?: string;
  messages?: { role: string; content: string }[];
  max_tokens?: number;
  stream?: boolean;
  reasoning?: { enabled?: boolean };
  mcpServers?: { name: string; url: string }[];
  webSearch?: boolean;
}

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Clé API OpenRouter absente. Créez un fichier .env.local à la racine du projet avec OPENROUTER_API_KEY=votre_clé, puis redémarrez le serveur (npm run dev).",
      },
      { status: 500 }
    );
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mcpServers = (body.mcpServers ?? []).filter(
    (s) => typeof s?.url === "string" && /^https?:\/\//.test(s.url)
  );

  if (mcpServers.length > 0 && body.stream) {
    return mcpToolLoopResponse(body, mcpServers, key);
  }

  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: openrouterHeaders(key),
    body: JSON.stringify({
      ...body,
      mcpServers: undefined,
      webSearch: undefined,
      // Plugin de recherche web d'OpenRouter : le fournisseur annote la
      // réponse avec des résultats web récents, quel que soit le modèle.
      ...(body.webSearch ? { plugins: [{ id: "web" }] } : {}),
    }),
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  if (body.stream && upstream.body) {
    // Repasse le flux SSE d'OpenRouter tel quel — le client lit les tokens
    // au fur et à mesure pour un affichage progressif de la réponse.
    return new NextResponse(upstream.body, { headers: sseHeaders() });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}

function openrouterHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://getgents.app",
    "X-Title": "Getgents",
  };
}

function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

/**
 * Boucle d'agent avec outils MCP : les tours intermédiaires (appels d'outils)
 * sont exécutés côté serveur, chaque appel étant signalé au client par un
 * événement SSE `tool_event` ; la réponse finale est renvoyée en deltas SSE
 * au même format qu'OpenRouter, donc le lecteur streaming existant côté
 * client fonctionne sans changement de contrat.
 */
function mcpToolLoopResponse(body: ChatBody, servers: { name: string; url: string }[], key: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const sendContent = (content: string) => send({ choices: [{ delta: { content } }] });
      const sendToolEvent = (ev: Record<string, unknown>) => send({ tool_event: ev });

      try {
        // 1. Connexion aux serveurs MCP + découverte des outils.
        const registry = new Map<string, { client: McpClient; tool: McpTool }>();
        const openaiTools: unknown[] = [];

        for (const srv of servers) {
          const client = new McpClient(srv.name, srv.url);
          try {
            await client.connect();
            const tools = await client.listTools();
            for (const tool of tools) {
              const fq = `${srv.name.replace(/[^a-zA-Z0-9_]/g, "_")}__${tool.name}`.slice(0, 64);
              registry.set(fq, { client, tool });
              openaiTools.push({
                type: "function",
                function: {
                  name: fq,
                  description: tool.description ?? "",
                  parameters: tool.inputSchema ?? { type: "object", properties: {} },
                },
              });
            }
            sendToolEvent({ status: "connected", server: srv.name, toolCount: tools.length });
          } catch (err) {
            sendToolEvent({ status: "connect_error", server: srv.name, message: (err as Error).message });
          }
        }

        const messages: Record<string, unknown>[] = [...(body.messages ?? [])];
        let sentContent = false;

        // 2. Boucle d'appels : le modèle décide quand utiliser les outils.
        // Au dernier tour, les outils sont retirés pour forcer une réponse.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const withTools = registry.size > 0 && round < MAX_TOOL_ROUNDS - 1;
          const res = await fetch(OPENROUTER_API, {
            method: "POST",
            headers: openrouterHeaders(key),
            body: JSON.stringify({
              model: body.model,
              messages,
              max_tokens: body.max_tokens ?? 2048,
              ...(withTools ? { tools: openaiTools } : {}),
              ...(body.webSearch ? { plugins: [{ id: "web" }] } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            const err = data?.error;
            const errText =
              typeof err === "string" ? err : typeof err?.message === "string" ? err.message : JSON.stringify(data);
            sendContent(`Erreur API : ${errText}`);
            sentContent = true;
            break;
          }

          const msg = data?.choices?.[0]?.message;
          const toolCalls: { id: string; function: { name: string; arguments: string } }[] =
            msg?.tool_calls ?? [];

          if (!toolCalls.length) {
            const content: string = msg?.content ?? "";
            // Contenu final : renvoyé en petits deltas pour conserver
            // l'affichage progressif côté client.
            for (let i = 0; i < content.length; i += 60) {
              sendContent(content.slice(i, i + 60));
            }
            if (content) sentContent = true;
            break;
          }

          messages.push({ role: "assistant", content: msg?.content ?? null, tool_calls: toolCalls });

          for (const tc of toolCalls) {
            const entry = registry.get(tc.function.name);
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              // arguments malformés — l'outil recevra un objet vide
            }

            sendToolEvent({ status: "running", call: tc.function.name, args });

            let resultText: string;
            let ok = true;
            if (!entry) {
              resultText = `Outil inconnu : ${tc.function.name}`;
              ok = false;
            } else {
              try {
                const result = await entry.client.callTool(entry.tool.name, args);
                resultText = result.text.slice(0, TOOL_RESULT_MAX_CHARS);
                ok = !result.isError;
              } catch (err) {
                resultText = `Erreur d'appel : ${(err as Error).message}`;
                ok = false;
              }
            }

            sendToolEvent({ status: "done", call: tc.function.name, ok });
            messages.push({ role: "tool", tool_call_id: tc.id, content: resultText });
          }
        }

        if (!sentContent) {
          sendContent(
            "Je n'ai pas pu finaliser une réponse (réponse vide ou limite d'appels d'outils atteinte). Réessayez ou reformulez votre question."
          );
        }
      } catch (err) {
        send({ choices: [{ delta: { content: `Erreur de traitement : ${(err as Error).message}` } }] });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, { headers: sseHeaders() });
}
