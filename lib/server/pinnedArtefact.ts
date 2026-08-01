// Génération / rafraîchissement d'un artefact figé « mini-app » côté serveur :
// le gent produit un tableau de bord (DashboardSpec) à partir d'une mission
// fixe et des entrées de l'utilisateur (LinkedIn, CV…). Seules les données
// changent d'une génération à l'autre ; la nature du rendu reste un dashboard.
import type { Espace, PinnedArtefact, PinnedRun } from "@/lib/types";
import { parseDashboard, DASHBOARD_BLOCKS_SCHEMA, type DashboardSpec } from "@/lib/dashboardArtefact";
import { profileContextNote } from "@/lib/profileSignal";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { extractJsonFromHtmlMarker } from "@/lib/server/markerJson";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
/** Modèle fiable pour la structure JSON du dashboard (indépendamment du modèle chat du gent). */
const PINNED_MODEL_FALLBACK = "anthropic/claude-sonnet-5";

export interface PinnedRefreshResult {
  ok: boolean;
  note: string;
  pinned: PinnedArtefact;
  /** Métriques de la génération, également archivées dans pinned.runs. */
  run?: PinnedRun;
}

/** Nombre de générations conservées dans l'historique de l'artefact. */
const MAX_RUNS = 20;

/** Résultat d'un appel au modèle, diagnostics compris. */
interface PinnedCall {
  text: string;
  httpStatus?: number;
  totalTokens?: number;
  errorNote?: string;
}

/** Ajoute la trace en tête d'historique et borne la liste. */
function withRun(pinned: PinnedArtefact, run: PinnedRun): PinnedArtefact {
  return { ...pinned, runs: [run, ...(pinned.runs ?? [])].slice(0, MAX_RUNS) };
}

/**
 * (Ré)génère le dashboard de l'artefact figé. Renvoie le pinnedArtefact mis à
 * jour (dashboard + generatedAt) — l'appelant persiste l'espace.
 */
export async function refreshPinnedArtefact(
  espace: Espace,
  source: PinnedRun["source"] = "espace"
): Promise<PinnedRefreshResult> {
  const pinned = espace.pinnedArtefact;
  const stamp = new Date().toISOString();
  const startedAt = Date.now();
  if (!pinned?.enabled || !pinned.mission.trim()) {
    return { ok: false, note: "artefact figé non configuré", pinned: pinned ?? { enabled: false, title: "", mission: "", inputs: [] } };
  }

  // Toute sortie passe par ici : un échec laisse désormais la même trace
  // exploitable qu'un succès (c'était le principal angle mort de l'audit).
  const finish = (ok: boolean, note: string, extra: Partial<PinnedRun>, next?: PinnedArtefact): PinnedRefreshResult => {
    const run: PinnedRun = {
      at: stamp,
      ok,
      note,
      durationMs: Date.now() - startedAt,
      source,
      ...extra,
    };
    return { ok, note, pinned: withRun(next ?? pinned, run), run };
  };

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return finish(false, "clé API absente", { attempts: 0 }, { ...pinned, generatedAt: stamp });

  const inputsBlock = pinned.inputs.length
    ? "\n\nENTRÉES FOURNIES PAR L'UTILISATEUR :\n" +
      pinned.inputs.map((i) => `- ${i.label} : ${i.value?.trim() || "(non renseigné)"}`).join("\n")
    : "";
  const profileNote = espace.profile ? `\n\n${profileContextNote(espace.profile)}` : "";
  const dateNote = `Date : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })} (Paris).`;

  const systemPrompt =
    `${espace.systemPrompt?.trim() || `Tu es le gent « ${espace.name} ».`}\n\n${dateNote}${profileNote}` +
    "\n\nCONTEXTE : tu produis un ARTEFACT FIGÉ — un tableau de bord dense, sans conversation. " +
    "Fais ressortir les informations clés (indicateurs, comparaisons, tableaux). " +
    (espace.webSearch ? "Appuie-toi sur la recherche web et n'invente aucune donnée non vérifiée. " : "") +
    "\n\nFORMAT DE RÉPONSE OBLIGATOIRE : ta réponse ENTIÈRE doit être UNIQUEMENT ce bloc HTML, sans texte avant ni après :\n" +
    '<!--PINNED: {"dashboard":{"subtitle":"…","blocks":[…]}}-->\n' +
    "Exemple minimal valide :\n" +
    '<!--PINNED: {"dashboard":{"blocks":[{"type":"stats","items":[{"label":"Indicateur","value":"42"}]},{"type":"text","body":"Synthèse."}]}}-->\n\n' +
    DASHBOARD_BLOCKS_SCHEMA;

  const userContent = `${pinned.mission}${inputsBlock}`;
  const model = espace.chatModelId ?? PINNED_MODEL_FALLBACK;

  let attempts = 1;
  let usedModel = model;
  let call = await callPinnedModel(key, model, systemPrompt, userContent, espace.webSearch);
  let raw = call.text;
  let dashboard = raw ? extractPinnedDashboard(raw) : null;

  // 2e tentative : modèle de repli + consigne plus stricte (structure JSON souvent
  // ratée par les modèles reasoning ou avec recherche web).
  if (!dashboard) {
    const retryModel = model === PINNED_MODEL_FALLBACK ? model : PINNED_MODEL_FALLBACK;
    attempts = 2;
    const retry = await callPinnedModel(
      key,
      retryModel,
      systemPrompt +
        "\n\nRAPPEL CRITIQUE : n'écris AUCUN texte libre. Émets UNIQUEMENT <!--PINNED: {\"dashboard\":{\"blocks\":[…]}}--> avec au moins 3 blocs valides.",
      `${userContent}\n\n(Réponds uniquement par le bloc <!--PINNED: …--> avec un dashboard complet.)`,
      false
    );
    call = retry;
    if (retry.text) {
      raw = retry.text;
      usedModel = retryModel;
      dashboard = extractPinnedDashboard(retry.text);
    }
  }

  const metrics = { attempts, model: usedModel, httpStatus: call.httpStatus, totalTokens: call.totalTokens };

  if (!raw?.trim()) {
    // On remonte la cause réelle (401, 429, timeout…) au lieu du générique
    // « réponse vide » : c'est ce qui rend l'échec diagnosticable.
    const cause = call.errorNote ? ` — ${call.errorNote}` : " — essayez sans recherche web ou changez le modèle chat";
    return finish(false, `réponse vide du modèle${cause}`, metrics);
  }

  if (!dashboard) {
    const hint = raw.includes("<!--PINNED") || raw.includes("<!--ARTEFACT")
      ? "bloc détecté mais JSON ou blocs invalides"
      : "aucun bloc PINNED/ARTEFACT détecté";
    return finish(false, `réponse illisible (dashboard non produit) — ${hint}`, metrics);
  }

  return finish(
    true,
    `ok — ${dashboard.blocks.length} blocs`,
    { ...metrics, blocks: dashboard.blocks.length },
    { ...pinned, dashboard, generatedAt: stamp }
  );
}

async function callPinnedModel(
  key: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  webSearch?: boolean
): Promise<PinnedCall> {
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 9000,
        ...(webSearch ? { plugins: [{ id: "web" }] } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      // Le corps porte la vraie cause (quota, clé invalide, modèle inconnu) :
      // sans lui, tous les échecs se ressemblaient.
      const body = await res.text().catch(() => "");
      return {
        text: "",
        httpStatus: res.status,
        errorNote: `échec LLM ${res.status}${body ? ` : ${body.slice(0, 160)}` : ""}`,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: Record<string, unknown> }[];
      usage?: { total_tokens?: number };
    };
    return { text: extractLlmMessageText(data), httpStatus: res.status, totalTokens: data.usage?.total_tokens };
  } catch (e) {
    return { text: "", errorNote: `échec réseau : ${(e as Error).message.slice(0, 140)}` };
  }
}

/** Un objet candidat est un dashboard s'il porte des blocks, éventuellement sous une clé `dashboard`. */
function coerceDashboard(parsed: unknown): DashboardSpec | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.kind === "dashboard" && o.dashboard) return parseDashboard(o.dashboard);
  return parseDashboard(o.dashboard ?? o);
}

/**
 * Extrait et valide le DashboardSpec de la réponse — tolérant au format exact
 * du modèle : bloc PINNED, bloc ARTEFACT dashboard, JSON en fence ```json, ou
 * premier objet JSON contenant « blocks » dans le texte brut.
 */
export function extractPinnedDashboard(raw: string): DashboardSpec | null {
  const tryParse = (s: string): DashboardSpec | null => {
    try {
      return coerceDashboard(JSON.parse(s));
    } catch {
      return null;
    }
  };

  for (const marker of ["PINNED", "ARTEFACT"] as const) {
    const json = extractJsonFromHtmlMarker(raw, marker);
    if (json) {
      const spec = tryParse(json);
      if (spec) return spec;
    }
  }

  const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) {
    const spec = tryParse(fence[1]);
    if (spec) return spec;
  }

  for (const candidate of balancedJsonObjects(raw)) {
    if (!candidate.includes('"blocks"')) continue;
    const spec = tryParse(candidate);
    if (spec) return spec;
  }
  return null;
}

/** Sous-chaînes JSON à accolades équilibrées du texte (naïf mais suffisant). */
function balancedJsonObjects(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          out.push(text.slice(i, j + 1));
          i = j;
          break;
        }
      }
    }
  }
  return out;
}
