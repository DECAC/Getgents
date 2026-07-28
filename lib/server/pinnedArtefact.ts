// Génération / rafraîchissement d'un artefact figé « mini-app » côté serveur :
// le gent produit un tableau de bord (DashboardSpec) à partir d'une mission
// fixe et des entrées de l'utilisateur (LinkedIn, CV…). Seules les données
// changent d'une génération à l'autre ; la nature du rendu reste un dashboard.
import type { Espace, PinnedArtefact } from "@/lib/types";
import { parseDashboard, DASHBOARD_PROMPT_INSTRUCTION, type DashboardSpec } from "@/lib/dashboardArtefact";
import { profileContextNote } from "@/lib/profileSignal";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const PINNED_RE = /<!--PINNED:\s*(\{[\s\S]*?\})\s*-->/;

export interface PinnedRefreshResult {
  ok: boolean;
  note: string;
  pinned: PinnedArtefact;
}

/**
 * (Ré)génère le dashboard de l'artefact figé. Renvoie le pinnedArtefact mis à
 * jour (dashboard + generatedAt) — l'appelant persiste l'espace.
 */
export async function refreshPinnedArtefact(espace: Espace): Promise<PinnedRefreshResult> {
  const pinned = espace.pinnedArtefact;
  const stamp = new Date().toISOString();
  if (!pinned?.enabled || !pinned.mission.trim()) {
    return { ok: false, note: "artefact figé non configuré", pinned: pinned ?? { enabled: false, title: "", mission: "", inputs: [] } };
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, note: "clé API absente", pinned: { ...pinned, generatedAt: stamp } };

  const inputsBlock = pinned.inputs.length
    ? "\n\nENTRÉES FOURNIES PAR L'UTILISATEUR :\n" +
      pinned.inputs.map((i) => `- ${i.label} : ${i.value?.trim() || "(non renseigné)"}`).join("\n")
    : "";
  const profileNote = espace.profile ? `\n\n${profileContextNote(espace.profile)}` : "";
  const dateNote = `Date : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })} (Paris).`;

  const systemPrompt =
    `${espace.systemPrompt?.trim() || `Tu es le gent « ${espace.name} ».`}\n\n${dateNote}${profileNote}` +
    "\n\nCONTEXTE : tu produis un ARTEFACT FIGÉ — un tableau de bord dense, lu comme une mini-application, sans conversation. " +
    "Fais ressortir les informations clés au premier plan (indicateurs, comparaisons, tableaux), du plus important au moins important. " +
    (espace.webSearch ? "Appuie-toi sur la recherche web et n'invente aucune donnée non vérifiée. " : "") +
    "Tu DOIS répondre en émettant UNIQUEMENT le bloc suivant (aucun autre texte) : " +
    '<!--PINNED: {"dashboard":{"subtitle":"...","blocks":[...]}}--> ' +
    "où le dashboard suit ce schéma :\n" +
    DASHBOARD_PROMPT_INSTRUCTION;

  let raw: string;
  try {
    const res = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: espace.chatModelId ?? "anthropic/claude-sonnet-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${pinned.mission}${inputsBlock}` },
        ],
        // Budget large + raisonnement bridé : sinon la recherche web + le
        // raisonnement épuisent le budget et `content` revient vide.
        max_tokens: 9000,
        reasoning: { effort: "low" },
        ...(espace.webSearch ? { plugins: [{ id: "web" }] } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160);
      return { ok: false, note: `échec LLM ${res.status} : ${detail}`, pinned: { ...pinned, generatedAt: stamp } };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    return { ok: false, note: `échec réseau : ${(e as Error).message.slice(0, 140)}`, pinned: { ...pinned, generatedAt: stamp } };
  }

  const dashboard = extractPinnedDashboard(raw);
  if (!dashboard) {
    // Échec de parsing : on conserve l'ancien rendu ET l'ancien horodatage
    // (« données à jour » reste honnête).
    return { ok: false, note: "réponse illisible (dashboard non produit)", pinned };
  }
  return { ok: true, note: `ok — ${dashboard.blocks.length} blocs`, pinned: { ...pinned, dashboard, generatedAt: stamp } };
}

/** Un objet candidat est un dashboard s'il porte des blocks, éventuellement sous une clé `dashboard`. */
function coerceDashboard(parsed: unknown): DashboardSpec | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
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

  const pinned = raw.match(PINNED_RE);
  if (pinned) {
    const spec = tryParse(pinned[1]);
    if (spec) return spec;
  }

  const artefact = raw.match(/<!--ARTEFACT:\s*(\{[\s\S]*?\})\s*-->/);
  if (artefact) {
    const spec = tryParse(artefact[1]);
    if (spec) return spec;
  }

  // Bloc de code ```json … ``` ou ``` … ```
  const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fence) {
    const spec = tryParse(fence[1]);
    if (spec) return spec;
  }

  // Dernier recours : balayer chaque objet JSON équilibré qui mentionne « blocks ».
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
