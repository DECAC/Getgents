import { NextRequest, NextResponse } from "next/server";
import { McpClient } from "@/lib/server/mcp";
import {
  buildDatasetRuntimeInstructions,
  getDatasetMeta,
  searchNearby,
  searchRecords,
} from "@/lib/server/opendatasoft";
import { stopsNearby, nextDepartures } from "@/lib/server/prim";
import { accounts as powensAccounts, transactions as powensTransactions } from "@/lib/server/powens";
import { callRestApi } from "@/lib/server/restApi";
import { parseDatasetUrl, type DatasetRef } from "@/lib/opendatasoft";
import type { RestApiConnector } from "@/lib/types";
import type { StatusEvent, ThinkingPhase } from "@/lib/streamChat";
import { defaultStatusLabel, humanToolCallLabel } from "@/lib/streamChat";

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
  datasets?: { name: string; url: string }[];
  prim?: boolean;
  powens?: boolean;
  restApis?: RestApiConnector[];
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
  const datasets = (body.datasets ?? [])
    .map((d) => {
      const ref = typeof d?.url === "string" ? parseDatasetUrl(d.url) : null;
      return ref ? { ...ref, label: d.name } : null;
    })
    .filter((d): d is DatasetRef & { label: string } => d !== null);

  const restApis = (body.restApis ?? []).filter(
    (r) => r && typeof r.name === "string" && r.config && typeof r.config.baseUrl === "string"
  );

  if (
    (mcpServers.length > 0 || datasets.length > 0 || body.prim || body.powens || restApis.length > 0) &&
    body.stream
  ) {
    return toolLoopResponse(body, mcpServers, datasets, !!body.prim, !!body.powens, restApis, key);
  }

  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: openrouterHeaders(key),
    body: JSON.stringify({
      ...body,
      mcpServers: undefined,
      datasets: undefined,
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

function extractReasoningText(msg: Record<string, unknown> | undefined): string {
  if (!msg) return "";
  const details = msg.reasoning_details as { text?: string }[] | undefined;
  if (Array.isArray(details)) return details.map((d) => d.text ?? "").join("");
  return typeof msg.reasoning === "string" ? msg.reasoning : "";
}

function sendReasoningChunks(send: (obj: unknown) => void, reasoning: string) {
  if (!reasoning) return;
  for (let i = 0; i < reasoning.length; i += 80) {
    send({ choices: [{ delta: { reasoning: reasoning.slice(i, i + 80) } }] });
  }
}

/** Un outil exécutable côté serveur, quel que soit son transport (MCP, dataset…). */
interface ServerTool {
  exec: (args: Record<string, unknown>) => Promise<{ text: string; ok: boolean }>;
}

/**
 * Boucle d'agent avec outils serveur (MCP et datasets open data) : les tours
 * intermédiaires (appels d'outils) sont exécutés côté serveur, chaque appel
 * étant signalé au client par un événement SSE `tool_event` ; la réponse
 * finale est renvoyée en deltas SSE au même format qu'OpenRouter, donc le
 * lecteur streaming existant côté client fonctionne sans changement de contrat.
 */
function toolLoopResponse(
  body: ChatBody,
  servers: { name: string; url: string }[],
  datasets: (DatasetRef & { label: string })[],
  prim: boolean,
  powens: boolean,
  restApis: RestApiConnector[],
  key: string
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const sendContent = (content: string) => send({ choices: [{ delta: { content } }] });
      const sendToolEvent = (ev: Record<string, unknown>) => send({ tool_event: ev });
      const sendStatus = (phase: ThinkingPhase, label?: string, detail?: string) => {
        const ev: StatusEvent = { phase, label: label ?? defaultStatusLabel(phase, detail) };
        send({ status_event: ev });
      };
      // Ping SSE pendant les boucles d'outils longues — évite les coupures « network error ».
      const keepAlive = setInterval(() => {
        sendStatus("thinking", "Traitement en cours…");
      }, 12_000);

      try {
        sendStatus("preparing");
        // 1. Construction du registre d'outils : serveurs MCP (découverte) et
        // datasets open data (proximité ou filtres selon métadonnées).
        const registry = new Map<string, ServerTool>();
        const openaiTools: unknown[] = [];

        if (servers.length || datasets.length || prim || powens || restApis.length) {
          sendStatus("connecting");
        }

        for (const srv of servers) {
          const client = new McpClient(srv.name, srv.url);
          try {
            await client.connect();
            const tools = await client.listTools();
            for (const tool of tools) {
              const fq = `${srv.name.replace(/[^a-zA-Z0-9_]/g, "_")}__${tool.name}`.slice(0, 64);
              registry.set(fq, {
                exec: async (args) => {
                  const result = await client.callTool(tool.name, args);
                  return { text: result.text, ok: !result.isError };
                },
              });
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

        const datasetMetas = await Promise.all(datasets.map((ds) => getDatasetMeta(ds)));
        for (let i = 0; i < datasets.length; i++) {
          const ds = datasets[i];
          const meta = datasetMetas[i];
          const slug = ds.datasetId.replace(/[^a-zA-Z0-9_]/g, "_");

          if (meta.geoField) {
            const fq = `dataset_${slug}__nearby`.slice(0, 64);
            registry.set(fq, {
              exec: async (args) => {
                const lat = Number(args.lat);
                const lon = Number(args.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                  return { text: "Paramètres lat/lon manquants ou invalides.", ok: false };
                }
                const text = await searchNearby(ds, {
                  lat,
                  lon,
                  radiusM: typeof args.radius_m === "number" ? args.radius_m : undefined,
                  limit: typeof args.limit === "number" ? args.limit : undefined,
                });
                return { text, ok: !text.includes('"error"') };
              },
            });
            openaiTools.push({
              type: "function",
              function: {
                name: fq,
                description: `Recherche dans « ${ds.label} » (${ds.datasetId}) les enregistrements les plus proches d'une position GPS, triés par distance.`,
                parameters: {
                  type: "object",
                  properties: {
                    lat: { type: "number", description: "Latitude WGS84" },
                    lon: { type: "number", description: "Longitude WGS84" },
                    radius_m: { type: "number", description: "Rayon en mètres (défaut 1500)" },
                    limit: { type: "number", description: "Nombre max de résultats (défaut 5)" },
                  },
                  required: ["lat", "lon"],
                },
              },
            });
          } else {
            const fq = `dataset_${slug}__query`.slice(0, 64);
            registry.set(fq, {
              exec: async (args) => {
                const text = await searchRecords(ds, {
                  commune_insee: typeof args.commune_insee === "string" ? args.commune_insee : undefined,
                  commune_name: typeof args.commune_name === "string" ? args.commune_name : undefined,
                  dep_code: typeof args.dep_code === "string" ? args.dep_code : undefined,
                  property_type:
                    args.property_type === "maison" || args.property_type === "appartement"
                      ? args.property_type
                      : undefined,
                  min_surface_m2: typeof args.min_surface_m2 === "number" ? args.min_surface_m2 : undefined,
                  max_surface_m2: typeof args.max_surface_m2 === "number" ? args.max_surface_m2 : undefined,
                  min_price: typeof args.min_price === "number" ? args.min_price : undefined,
                  max_price: typeof args.max_price === "number" ? args.max_price : undefined,
                  since_year: typeof args.since_year === "number" ? args.since_year : undefined,
                  search_text: typeof args.search_text === "string" ? args.search_text : undefined,
                  limit: typeof args.limit === "number" ? args.limit : undefined,
                });
                return { text, ok: !text.includes('"error"') };
              },
            });
            openaiTools.push({
              type: "function",
              function: {
                name: fq,
                description:
                  `Interroge le jeu de données tabulaire « ${ds.label} » (${ds.datasetId}, portail ${ds.domain}) par filtres. ` +
                  "Pour DVF : transactions immobilières par commune (code INSEE à 5 chiffres, pas le code postal), type de bien, surface, prix. " +
                  "Le résultat inclut un market_summary (prix/m² moyen, min, max) quand disponible. " +
                  "OBLIGATOIRE : commune_insee (code INSEE 5 chiffres) ou commune_name + dep_code — ex. Matignon → commune_insee=22118, dep_code=22.",
                parameters: {
                  type: "object",
                  properties: {
                    commune_insee: {
                      type: "string",
                      description: "Code INSEE commune (5 chiffres, ex. 22118 pour Matignon — pas 22550)",
                    },
                    commune_name: {
                      type: "string",
                      description: "Nom de la commune si le code INSEE est inconnu (ex. Matignon)",
                    },
                    dep_code: { type: "string", description: "Code département (ex. 22)" },
                    property_type: { type: "string", enum: ["maison", "appartement"] },
                    min_surface_m2: { type: "number", description: "Surface bâtie minimum (m²)" },
                    max_surface_m2: { type: "number", description: "Surface bâtie maximum (m²)" },
                    min_price: { type: "number", description: "Prix minimum (€)" },
                    max_price: { type: "number", description: "Prix maximum (€)" },
                    since_year: { type: "number", description: "Année minimum de mutation (ex. 2019)" },
                    search_text: { type: "string", description: "Recherche textuelle libre" },
                    limit: { type: "number", description: "Nombre max de transactions (défaut 15, max 50)" },
                  },
                },
              },
            });
          }
          sendToolEvent({ status: "connected", server: ds.label, toolCount: 1 });
        }

        if (prim) {
          registry.set("prim_stops_nearby", {
            exec: async (args) => {
              const lat = Number(args.lat);
              const lon = Number(args.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                return { text: "Paramètres lat/lon manquants ou invalides.", ok: false };
              }
              const text = await stopsNearby(lat, lon, typeof args.radius_m === "number" ? args.radius_m : undefined);
              return { text, ok: !text.includes('"error"') };
            },
          });
          registry.set("prim_next_departures", {
            exec: async (args) => {
              const stopId = typeof args.stop_id === "string" ? args.stop_id : "";
              const text = await nextDepartures(stopId);
              return { text, ok: !text.includes('"error"') };
            },
          });
          openaiTools.push(
            {
              type: "function",
              function: {
                name: "prim_stops_nearby",
                description:
                  "Île-de-France Mobilités (PRIM) : arrêts de transport (bus, métro, tram, RER) les plus proches d'une position GPS, avec leur stop_id et leurs lignes.",
                parameters: {
                  type: "object",
                  properties: {
                    lat: { type: "number", description: "Latitude WGS84" },
                    lon: { type: "number", description: "Longitude WGS84" },
                    radius_m: { type: "number", description: "Rayon en mètres (défaut 500)" },
                  },
                  required: ["lat", "lon"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "prim_next_departures",
                description:
                  "Île-de-France Mobilités (PRIM) : prochains passages (temps réel quand disponible) à un arrêt donné — utilise un stop_id renvoyé par prim_stops_nearby.",
                parameters: {
                  type: "object",
                  properties: {
                    stop_id: { type: "string", description: "Identifiant d'arrêt Navitia (stop_point:…)" },
                  },
                  required: ["stop_id"],
                },
              },
            }
          );
          sendToolEvent({ status: "connected", server: "IDFM PRIM", toolCount: 2 });
        }

        if (powens) {
          registry.set("powens_accounts", {
            exec: async () => {
              const text = await powensAccounts();
              return { text, ok: !text.includes('"error"') };
            },
          });
          registry.set("powens_transactions", {
            exec: async (args) => {
              const text = await powensTransactions(
                typeof args.min_date === "string" ? args.min_date : undefined,
                typeof args.limit === "number" ? args.limit : undefined
              );
              return { text, ok: !text.includes('"error"') };
            },
          });
          openaiTools.push(
            {
              type: "function",
              function: {
                name: "powens_accounts",
                description:
                  "Powens (agrégation bancaire, MODE SANDBOX) : liste les comptes bancaires de test liés et leurs soldes.",
                parameters: { type: "object", properties: {} },
              },
            },
            {
              type: "function",
              function: {
                name: "powens_transactions",
                description:
                  "Powens (MODE SANDBOX) : transactions bancaires de test, triées de la plus récente à la plus ancienne. Utilise min_date (AAAA-MM-JJ) pour borner la période.",
                parameters: {
                  type: "object",
                  properties: {
                    min_date: { type: "string", description: "Date minimum AAAA-MM-JJ (optionnel)" },
                    limit: { type: "number", description: "Nombre maximum de transactions (défaut 100, max 500)" },
                  },
                },
              },
            }
          );
          sendToolEvent({ status: "connected", server: "Powens (sandbox)", toolCount: 2 });
        }

        // Connecteurs API REST personnalisés : chaque connecteur devient un
        // outil dont le schéma est déduit des paramètres déclarés par le
        // créateur ; l'appel HTTP réel est exécuté côté serveur.
        const usedRestNames = new Set<string>();
        for (const rest of restApis) {
          let fq = `rest_${rest.name.replace(/[^a-zA-Z0-9_]/g, "_")}`.slice(0, 60).replace(/_+$/, "");
          if (!fq || fq === "rest") fq = "rest_api";
          let unique = fq;
          let n = 2;
          while (usedRestNames.has(unique)) unique = `${fq}_${n++}`.slice(0, 64);
          usedRestNames.add(unique);

          const properties: Record<string, unknown> = {};
          const required: string[] = [];
          for (const p of rest.config.modelParams ?? []) {
            if (!p.name?.trim()) continue;
            properties[p.name.trim()] = {
              type: "string",
              description: p.example ? `${p.description} (ex. ${p.example})` : p.description,
            };
            if (p.required) required.push(p.name.trim());
          }

          registry.set(unique, {
            exec: async (args) => callRestApi(rest.config, args),
          });
          openaiTools.push({
            type: "function",
            function: {
              name: unique,
              description:
                `API REST « ${rest.name} » configurée par le créateur. ${rest.config.description}` +
                (rest.config.responseHint ? ` Exploitation de la réponse : ${rest.config.responseHint}` : ""),
              parameters: { type: "object", properties, ...(required.length ? { required } : {}) },
            },
          });
          sendToolEvent({ status: "connected", server: rest.name, toolCount: 1 });
        }

        const messages: Record<string, unknown>[] = [...(body.messages ?? [])];
        const datasetHint = buildDatasetRuntimeInstructions(datasets, datasetMetas);
        if (datasetHint && messages.length && messages[0].role === "system") {
          messages[0] = { ...messages[0], content: String(messages[0].content ?? "") + datasetHint };
        } else if (datasetHint) {
          messages.unshift({ role: "system", content: datasetHint.trim() });
        }
        let sentContent = false;
        // Disjoncteur : au 3e échec d'un même outil dans la requête, on
        // court-circuite les appels suivants au lieu de laisser le modèle
        // réessayer en boucle.
        const toolFailures = new Map<string, number>();

        // 2. Boucle d'appels : le modèle décide quand utiliser les outils.
        // Au dernier tour, les outils sont retirés pour forcer une réponse.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const withTools = registry.size > 0 && round < MAX_TOOL_ROUNDS - 1;
          sendStatus("thinking");
          const res = await fetch(OPENROUTER_API, {
            method: "POST",
            headers: openrouterHeaders(key),
            body: JSON.stringify({
              model: body.model,
              messages,
              max_tokens: body.max_tokens ?? 12_288,
              ...(withTools ? { tools: openaiTools } : {}),
              ...(body.webSearch ? { plugins: [{ id: "web" }] } : {}),
              ...(body.reasoning ? { reasoning: body.reasoning } : {}),
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

          const msg = data?.choices?.[0]?.message as Record<string, unknown> | undefined;
          const finishReason = data?.choices?.[0]?.finish_reason as string | undefined;
          const toolCalls: { id: string; function: { name: string; arguments: string } }[] =
            (msg?.tool_calls as typeof toolCalls) ?? [];

          if (!toolCalls.length) {
            const reasoning = extractReasoningText(msg);
            sendReasoningChunks(send, reasoning);
            const content: string = (msg?.content as string) ?? "";
            sendStatus("writing");
            for (let i = 0; i < content.length; i += 60) {
              sendContent(content.slice(i, i + 60));
            }
            if (finishReason === "length") {
              send({ choices: [{ finish_reason: "length" }] });
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

            sendStatus("tool_running", undefined, humanToolCallLabel(tc.function.name));
            sendToolEvent({ status: "running", call: tc.function.name, args });

            let resultText: string;
            let ok = true;
            if (!entry) {
              resultText = `Outil inconnu : ${tc.function.name}`;
              ok = false;
            } else if ((toolFailures.get(tc.function.name) ?? 0) >= 3) {
              resultText = `Outil ${tc.function.name} désactivé pour cette réponse après 3 échecs consécutifs. N'appelle plus cet outil : réponds à l'utilisateur avec les informations déjà obtenues, explique l'indisponibilité et propose une alternative.`;
              ok = false;
            } else {
              try {
                const result = await entry.exec(args);
                resultText = result.text.slice(0, TOOL_RESULT_MAX_CHARS);
                ok = result.ok;
              } catch (err) {
                resultText = `Erreur d'appel : ${(err as Error).message}`;
                ok = false;
              }
            }

            if (!ok) toolFailures.set(tc.function.name, (toolFailures.get(tc.function.name) ?? 0) + 1);
            sendToolEvent({
              status: "done",
              call: tc.function.name,
              ok,
              // Diagnostic visible côté client uniquement en cas d'échec.
              ...(ok ? {} : { detail: resultText.slice(0, 600) }),
            });
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
        clearInterval(keepAlive);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, { headers: sseHeaders() });
}
