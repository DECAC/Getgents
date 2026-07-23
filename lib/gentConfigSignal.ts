// Proposition de configuration complète du gent par l'assistant du builder :
// nom, objectif, prompt système, modèles, recherche web, connecteurs — le
// tout dans un bloc unique, appliqué au draft seulement après validation
// explicite du créateur (carte « Appliquer la configuration »).
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { parseDatasetUrl, DVF_CANONICAL_DATASET_URL, datasetRefToDetail } from "@/lib/opendatasoft";
import type { RestApiToolConfig, RestApiAuth, PinnedArtefactInput } from "@/lib/types";

const GENT_CONFIG_RE = /<!--GENT_CONFIG:\s*(\{[\s\S]*?\})\s*-->/;

export interface GentConfigConnector {
  kind: "dataset" | "mcp" | "api-rest" | "prim" | "powens";
  name: string;
  url: string;
  /** Configuration complète pour un connecteur API REST (kind === "api-rest"). */
  restConfig?: RestApiToolConfig;
}

const PRIM_DEFAULT_URL = "https://prim.iledefrance-mobilites.fr/marketplace";
const POWENS_DEFAULT_URL = "https://webview.powens.com (sandbox)";

export interface GentConfigProposal {
  name?: string;
  objective?: string;
  systemPrompt?: string;
  webSearch?: boolean;
  chatModelId?: string;
  reasoningModelId?: string;
  connectors?: GentConfigConnector[];
  /**
   * Artefact figé « mini-app » : le champ `mission` est le « prompt figé »
   * (l'instruction de génération du tableau de bord), distinct du systemPrompt.
   */
  pinnedArtefact?: {
    enabled?: boolean;
    title?: string;
    mission?: string;
    inputs?: PinnedArtefactInput[];
  };
}

export const GENT_CONFIG_PROMPT_INSTRUCTION =
  "Tu peux configurer le gent à la place du créateur, sous réserve de sa validation. Dès que tu proposes un prompt système, un nom, un objectif, un modèle, l'activation de la recherche web ou des connecteurs, termine ta réponse (sur sa propre ligne) par exactement un bloc " +
  '<!--GENT_CONFIG: {"name":"…","objective":"…","systemPrompt":"…","webSearch":true,"chatModelId":"…","reasoningModelId":"…","connectors":[{"kind":"dataset","name":"…","url":"https://…"}]}--> ' +
  "en n'incluant QUE les champs que tu proposes de changer (tous optionnels ; chatModelId/reasoningModelId doivent venir du catalogue de modèles ci-dessus ; kind parmi dataset/mcp/api-rest/prim, URL réelles uniquement — \"prim\" est le connecteur intégré Île-de-France Mobilités (transports IDF temps réel) et \"powens\" le connecteur intégré d'agrégation bancaire Powens en MODE SANDBOX, url facultative pour ces deux-là). " +
  "Pour un connecteur \"api-rest\" (n'importe quelle API REST à brancher toi-même, ex. SerpApi Google Flights), n'utilise PAS le champ url : fournis un objet restConfig complet, ainsi : " +
  '{"kind":"api-rest","name":"Nom lisible","restConfig":{"method":"GET","baseUrl":"https://serpapi.com/search","description":"À quoi sert l\'outil et quand l\'appeler","queryParams":[{"name":"engine","value":"google_flights"}],"auth":{"mode":"api-key","placement":"query","fieldName":"api_key","value":"env:SERPAPI_KEY"},"modelParams":[{"name":"departure_id","description":"Code IATA de l\'aéroport de départ","required":true,"example":"CDG"}],"responseHint":"Utilise le tableau best_flights"}}. ' +
  "Règles pour restConfig : method GET ou POST ; baseUrl est une URL réelle sans les paramètres ; queryParams sont les valeurs fixes toujours envoyées ; auth.mode \"api-key\" ou \"none\" et, pour une clé secrète, mets TOUJOURS value \"env:NOM_DE_VARIABLE\" (jamais une vraie clé inventée) ; modelParams sont les paramètres que le gent remplira à chaque appel d'après la conversation. " +
  "IMPÉRATIF : les identifiants d'authentification (clé d'API, app_id, app_key, client_id, token, secret…) ne doivent JAMAIS figurer dans modelParams — le modèle ne peut pas deviner un identifiant, cela provoque un échec d'authentification. Mets la clé principale dans auth (value \"env:NOM\") et tout identifiant secondaire (ex. app_id pour Adzuna, qui exige app_id ET app_key) dans queryParams avec value \"env:NOM\". modelParams ne contient QUE de vrais critères de recherche (mots-clés, lieu, date, filtres). " +
  "Une carte « Appliquer la configuration » s'affiche alors : le créateur valide en un clic et tout est appliqué au gent (nom, prompt, modèles, connecteurs…). " +
  "Règles impératives : n'annonce JAMAIS que tu configures ou vas configurer quelque chose sans émettre ce bloc dans le MÊME message ; si le créateur accepte verbalement une proposition faite plus tôt, ré-émets immédiatement le bloc GENT_CONFIG complet correspondant ; ne renvoie jamais le créateur vers une configuration manuelle (onglets, listes déroulantes) pour ce que ce bloc sait faire. " +
  "Économie de longueur : ne recopie PAS l'intégralité du prompt système dans le texte visible — résume tes choix en quelques puces courtes, le contenu complet vit uniquement dans le bloc GENT_CONFIG (le créateur le verra dans la carte de validation et l'onglet Prompt). Tout connecteur que tu annonces DOIT figurer dans le champ connectors de ce même bloc. " +
  "Tu peux aussi transformer le gent en ARTEFACT FIGÉ « mini-application » : au lieu de converser, il produit un tableau de bord permanent que l'utilisateur rafraîchit d'un bouton, à partir d'entrées limitées (lien, CV…). Pour le proposer ou le modifier, ajoute au bloc GENT_CONFIG un objet pinnedArtefact, ainsi : " +
  '"pinnedArtefact":{"enabled":true,"title":"Titre lisible","mission":"Décris précisément le tableau de bord à produire à chaque génération : sections, indicateurs clés, tableaux","inputs":[{"id":"cv","label":"CV du candidat","kind":"file"}]}. ' +
  "Le champ mission EST le « prompt figé » (l'instruction de génération de l'artefact) ; kind vaut url, file ou text. Ne confonds pas mission (ce que l'artefact figé génère) et systemPrompt (le comportement général du gent) — ce sont deux prompts distincts. " +
  "Pour un dataset DVF (transactions immobilières France), URL obligatoire : " +
  DVF_CANONICAL_DATASET_URL +
  " (pas data.opendatasoft.com, pas de suffixe @public).";

const VALID_MODEL_IDS = new Set(MODEL_CATALOG.map((m) => m.id));

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Valide/normalise un objet restConfig proposé par le modèle. */
function validateRestConfig(v: unknown): RestApiToolConfig | null {
  const c = v as Partial<RestApiToolConfig> | undefined;
  if (!c || typeof c.baseUrl !== "string" || !/^https?:\/\//.test(c.baseUrl)) return null;

  const kv = (arr: unknown) =>
    Array.isArray(arr)
      ? arr
          .filter((p) => p && typeof (p as { name?: unknown }).name === "string")
          .map((p) => ({ name: asStr((p as { name: unknown }).name), value: asStr((p as { value?: unknown }).value) }))
          .filter((p) => p.name.trim() !== "")
          .slice(0, 20)
      : [];

  const authRaw = c.auth as Partial<RestApiAuth> | undefined;
  const auth: RestApiAuth =
    authRaw && authRaw.mode === "api-key"
      ? {
          mode: "api-key",
          placement: authRaw.placement === "header" ? "header" : "query",
          fieldName: asStr(authRaw.fieldName),
          value: asStr(authRaw.value),
        }
      : { mode: "none", placement: "query", fieldName: "", value: "" };

  const modelParams = Array.isArray(c.modelParams)
    ? c.modelParams
        .filter((p) => p && typeof (p as { name?: unknown }).name === "string")
        .map((p) => {
          const o = p as { name: unknown; description?: unknown; required?: unknown; example?: unknown };
          return {
            name: asStr(o.name),
            description: asStr(o.description),
            required: !!o.required,
            example: typeof o.example === "string" && o.example.trim() ? o.example : undefined,
          };
        })
        .filter((p) => p.name.trim() !== "")
        .slice(0, 20)
    : [];

  return {
    method: c.method === "POST" ? "POST" : "GET",
    baseUrl: c.baseUrl,
    description: asStr(c.description),
    queryParams: kv(c.queryParams),
    headers: kv(c.headers),
    auth,
    modelParams,
    responseHint: typeof c.responseHint === "string" && c.responseHint.trim() ? c.responseHint : undefined,
  };
}

function validateConnector(c: unknown): GentConfigConnector | null {
  const p = c as Partial<GentConfigConnector>;
  if (!p || typeof p.name !== "string") return null;
  if (!["dataset", "mcp", "api-rest", "prim", "powens"].includes(p.kind as string)) return null;
  if (p.kind === "prim") return { kind: "prim", name: p.name, url: PRIM_DEFAULT_URL };
  if (p.kind === "powens") return { kind: "powens", name: p.name, url: POWENS_DEFAULT_URL };
  if (p.kind === "api-rest") {
    const restConfig = validateRestConfig(p.restConfig);
    if (!restConfig) return null;
    return { kind: "api-rest", name: p.name, url: restConfig.baseUrl, restConfig };
  }
  if (typeof p.url !== "string") return null;
  if (p.kind === "dataset") {
    const ref = parseDatasetUrl(p.url);
    if (!ref) return null;
    return { kind: "dataset", name: p.name, url: datasetRefToDetail(ref) };
  }
  if (!/^https?:\/\//.test(p.url)) return null;
  return { kind: p.kind as GentConfigConnector["kind"], name: p.name, url: p.url };
}

/** Valide/normalise une proposition d'artefact figé « mini-app » (partielle). */
function validatePinnedArtefact(v: unknown): GentConfigProposal["pinnedArtefact"] | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: NonNullable<GentConfigProposal["pinnedArtefact"]> = {};
  if (typeof o.enabled === "boolean") out.enabled = o.enabled;
  const title = str(o.title, 120);
  if (title) out.title = title;
  const mission = str(o.mission, 4000);
  if (mission) out.mission = mission;
  if (Array.isArray(o.inputs)) {
    out.inputs = o.inputs
      .filter((i) => i && typeof (i as { label?: unknown }).label === "string")
      .map((i, idx) => {
        const r = i as Record<string, unknown>;
        const kind = r.kind === "file" || r.kind === "text" ? r.kind : "url";
        return {
          id: typeof r.id === "string" && r.id.trim() ? r.id : `in-${idx}`,
          label: asStr(r.label).slice(0, 80),
          kind,
        } as PinnedArtefactInput;
      })
      .filter((i) => i.label.trim() !== "")
      .slice(0, 8);
  }
  return Object.keys(out).length ? out : undefined;
}

export function extractGentConfigSignal(raw: string): { text: string; config: GentConfigProposal | null } {
  const match = raw.match(GENT_CONFIG_RE);
  if (!match) return { text: raw, config: null };

  let config: GentConfigProposal | null = null;
  try {
    const p = JSON.parse(match[1]) as Record<string, unknown>;
    const chatModelId = typeof p.chatModelId === "string" && VALID_MODEL_IDS.has(p.chatModelId) ? p.chatModelId : undefined;
    const reasoningModelId =
      typeof p.reasoningModelId === "string" && VALID_MODEL_IDS.has(p.reasoningModelId) ? p.reasoningModelId : undefined;
    const connectors = Array.isArray(p.connectors)
      ? p.connectors.map(validateConnector).filter((c): c is GentConfigConnector => c !== null).slice(0, 6)
      : undefined;
    const candidate: GentConfigProposal = {
      name: str(p.name, 120),
      objective: str(p.objective, 300),
      systemPrompt: str(p.systemPrompt, 8000),
      webSearch: typeof p.webSearch === "boolean" ? p.webSearch : undefined,
      chatModelId,
      reasoningModelId,
      connectors: connectors?.length ? connectors : undefined,
      pinnedArtefact: validatePinnedArtefact(p.pinnedArtefact),
    };
    if (Object.values(candidate).some((v) => v !== undefined)) config = candidate;
  } catch {
    // bloc malformé — ignoré
  }

  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), config };
}
