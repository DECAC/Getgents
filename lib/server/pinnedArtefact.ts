// Génération / rafraîchissement d'un artefact figé « mini-app » côté serveur :
// le gent produit un tableau de bord (DashboardSpec) à partir d'une mission
// fixe et des entrées de l'utilisateur (LinkedIn, CV…). Seules les données
// changent d'une génération à l'autre ; la nature du rendu reste un dashboard.
import type { Espace, PinnedArtefact, PinnedRun } from "@/lib/types";
import { parseDashboard, DASHBOARD_BLOCKS_SCHEMA, type DashboardSpec } from "@/lib/dashboardArtefact";
import { profileContextNote } from "@/lib/profileSignal";
import { sessionContextNote } from "@/lib/sessionContext";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { extractJsonFromHtmlMarker } from "@/lib/server/markerJson";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
/** Modèle fiable pour la structure JSON du dashboard (indépendamment du modèle chat du gent). */
const PINNED_MODEL_FALLBACK = "anthropic/claude-sonnet-5";
/**
 * Plafond par appel OpenRouter. Sans signal, un LLM bloqué laisse Vercel tuer
 * la fonction → le navigateur voit « Failed to fetch » (connexion coupée)
 * plutôt qu'une erreur JSON exploitable. On laisse une marge sous maxDuration=300.
 */
const PINNED_CALL_TIMEOUT_MS = 150_000;
/** Au-delà, on saute la 2ᵉ tentative pour renvoyer une réponse avant le kill Vercel. */
const PINNED_RETRY_BUDGET_MS = 120_000;

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
  // Mémoire de l'espace et documents téléversés : jusqu'ici réservés à la
  // conversation, alors que la mini-app doit travailler sur le même contexte.
  const contextNote = sessionContextNote(espace);
  const dateNote = `Date : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" })} (Paris).`;

  const systemPrompt =
    `${espace.systemPrompt?.trim() || `Tu es le gent « ${espace.name} ».`}\n\n${dateNote}${profileNote}${contextNote}` +
    "\n\nCONTEXTE : tu produis un ARTEFACT FIGÉ — un tableau de bord dense, sans conversation. " +
    "Fais ressortir les informations clés (indicateurs, comparaisons, tableaux). " +
    (espace.webSearch ? "Appuie-toi sur la recherche web et n'invente aucune donnée non vérifiée. " : "") +
    "\n\nFORMAT DE RÉPONSE OBLIGATOIRE : ta réponse ENTIÈRE doit être UNIQUEMENT ce bloc HTML, sans texte avant ni après :\n" +
    '<!--PINNED: {"dashboard":{"subtitle":"…","blocks":[…]}}-->\n' +
    "Exemple minimal valide :\n" +
    '<!--PINNED: {"dashboard":{"blocks":[{"type":"stats","items":[{"label":"Indicateur","value":"42"}]},{"type":"text","body":"Synthèse."}]}}-->\n\n' +
    // Beaucoup de gents portent une règle « n'insère jamais de balise HTML »,
    // ajoutée pour empêcher les <cite> de la recherche web de polluer le rendu.
    // Prise au pied de la lettre, elle interdit aussi l'enveloppe <!--PINNED-->
    // et le modèle répond alors en prose : plus aucun bloc n'est détecté.
    // On lève explicitement l'ambiguïté, en dernier pour primer sur le reste.
    "PRÉSÉANCE : cette consigne l'emporte sur toute règle de format énoncée plus haut. " +
    "Le bloc <!--PINNED: …--> n'est pas du contenu : c'est l'enveloppe technique obligatoire de ta réponse. " +
    "Une éventuelle interdiction d'utiliser des balises HTML s'applique au CONTENU du tableau de bord " +
    "(titres, textes, cellules, qui doivent rester en texte brut, sans <cite>, <a> ni <span>), " +
    "jamais à cette enveloppe. Sans le bloc <!--PINNED: …-->, ta réponse est inexploitable.\n\n" +
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
  // Sautée si le 1er appel a déjà mangé le budget : deux appels × recherche web
  // dépassent souvent la limite Vercel et provoquent « Connexion interrompue ».
  if (!dashboard && Date.now() - startedAt < PINNED_RETRY_BUDGET_MS) {
    const retryModel = model === PINNED_MODEL_FALLBACK ? model : PINNED_MODEL_FALLBACK;
    attempts = 2;
    const retry = await callPinnedModel(
      key,
      retryModel,
      systemPrompt +
        "\n\nRAPPEL CRITIQUE : n'écris AUCUN texte libre, aucune introduction, aucune conclusion. " +
        "Commence ta réponse par les caractères <!--PINNED: et termine-la par -->. " +
        "Oui, ces caractères sont attendus, même si une règle plus haut interdit les balises HTML : " +
        "elle vise le contenu, pas cette enveloppe. Au moins 3 blocs valides.",
      `${userContent}\n\n(Réponds uniquement par le bloc <!--PINNED: …--> avec un dashboard complet.)`,
      false
    );
    call = retry;
    if (retry.text) {
      raw = retry.text;
      usedModel = retryModel;
      dashboard = extractPinnedDashboard(retry.text);
    }
  } else if (!dashboard) {
    // On conserve le diagnostic du 1er appel ; on signale juste qu'on n'a pas retenté.
    if (call.errorNote) {
      call = { ...call, errorNote: `${call.errorNote} (2ᵉ tentative sautée : délai déjà écoulé)` };
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
    return finish(
      false,
      `réponse illisible (dashboard non produit) — ${diagnosePinnedFailure(raw, espace.systemPrompt)}`,
      metrics
    );
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
        // Un tableau de bord dense (plusieurs onglets, tableaux, graphiques)
        // dépassait 9 000 tokens et revenait coupé en plein JSON. Le plafond
        // n'est pas facturé, seuls les tokens réellement produits le sont.
        max_tokens: 16_000,
        ...(webSearch ? { plugins: [{ id: "web" }] } : {}),
      }),
      cache: "no-store",
      // Évite que Vercel coupe la connexion sans réponse JSON (« Failed to fetch »).
      signal: AbortSignal.timeout(PINNED_CALL_TIMEOUT_MS),
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
    const msg = (e as Error).message ?? "erreur inconnue";
    const timedOut = (e as Error).name === "TimeoutError" || /aborted|timeout/i.test(msg);
    return {
      text: "",
      errorNote: timedOut
        ? `délai dépassé (${Math.round(PINNED_CALL_TIMEOUT_MS / 1000)}s) — recherche web ou modèle trop lent`
        : `échec réseau : ${msg.slice(0, 140)}`,
    };
  }
}

/**
 * Explique POURQUOI aucun dashboard n'a pu être produit. Le message précédent
 * (« bloc détecté mais JSON ou blocs invalides ») confondait deux causes très
 * différentes : une réponse coupée, et des blocs refusés par le schéma. La
 * correction n'est pas la même — d'un côté raccourcir la mission, de l'autre
 * corriger la forme des blocs demandés.
 */
export function diagnosePinnedFailure(raw: string, systemPrompt?: string): string {
  const hasMarker = raw.includes("<!--PINNED") || raw.includes("<!--ARTEFACT");
  if (!hasMarker) {
    // Cause la plus fréquente : le prompt du gent interdit les balises HTML
    // (règle ajoutée contre les <cite> de la recherche web), ce que le modèle
    // applique aussi à l'enveloppe <!--PINNED-->. Il répond alors en prose.
    if (systemPrompt && /jamais.{0,40}balises?\s+HTML|aucune?\s+balises?\s+HTML|pas\s+de\s+balises?\s+HTML/i.test(systemPrompt)) {
      return (
        "le modèle a répondu en texte libre, sans le bloc attendu — le prompt système du gent interdit " +
        "les balises HTML, ce que le modèle applique aussi à l'enveloppe <!--PINNED-->. Reformulez cette règle " +
        "pour qu'elle vise le contenu (« pas de <cite>, <a>, <span> dans les textes ») et non le format de réponse"
      );
    }
    return "aucun bloc PINNED/ARTEFACT détecté — le modèle a répondu en texte libre ; un modèle chat plus rigoureux sur les consignes de format peut aider";
  }

  const fragment =
    extractJsonFromHtmlMarker(raw, "PINNED") ?? extractJsonFromHtmlMarker(raw, "ARTEFACT");
  if (!fragment) {
    return "réponse coupée avant la fin du JSON — mission trop longue pour le budget de réponse, raccourcissez-la ou réduisez le nombre de sections";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fragment);
  } catch {
    return "JSON malformé dans le bloc émis";
  }

  const o = (parsed ?? {}) as Record<string, unknown>;
  const inner = (o.dashboard ?? o) as Record<string, unknown>;
  const blocks = Array.isArray(inner.blocks) ? inner.blocks : null;
  if (!blocks) return "le bloc émis ne contient pas de tableau « blocks »";
  if (blocks.length === 0) return "tableau « blocks » vide";

  const types = blocks
    .map((b) => (b && typeof b === "object" ? String((b as Record<string, unknown>).type ?? "?") : "?"))
    .slice(0, 8);
  return `${blocks.length} bloc(s) reçu(s), tous refusés par le schéma (types : ${types.join(", ")}) — vérifiez les champs obligatoires (stats/items, table/columns+rows, chart/series+data)`;
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
