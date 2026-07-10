// Proposition de configuration complète du gent par l'assistant du builder :
// nom, objectif, prompt système, modèles, recherche web, connecteurs — le
// tout dans un bloc unique, appliqué au draft seulement après validation
// explicite du créateur (carte « Appliquer la configuration »).
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { parseDatasetUrl } from "@/lib/opendatasoft";

const GENT_CONFIG_RE = /<!--GENT_CONFIG:\s*(\{[\s\S]*?\})\s*-->/;

export interface GentConfigConnector {
  kind: "dataset" | "mcp" | "api-rest";
  name: string;
  url: string;
}

export interface GentConfigProposal {
  name?: string;
  objective?: string;
  systemPrompt?: string;
  webSearch?: boolean;
  chatModelId?: string;
  reasoningModelId?: string;
  connectors?: GentConfigConnector[];
}

export const GENT_CONFIG_PROMPT_INSTRUCTION =
  "Tu peux configurer le gent à la place du créateur, sous réserve de sa validation. Dès que tu proposes un prompt système, un nom, un objectif, un modèle, l'activation de la recherche web ou des connecteurs, termine ta réponse (sur sa propre ligne) par exactement un bloc " +
  '<!--GENT_CONFIG: {"name":"…","objective":"…","systemPrompt":"…","webSearch":true,"chatModelId":"…","reasoningModelId":"…","connectors":[{"kind":"dataset","name":"…","url":"https://…"}]}--> ' +
  "en n'incluant QUE les champs que tu proposes de changer (tous optionnels ; chatModelId/reasoningModelId doivent venir du catalogue de modèles ci-dessus ; kind parmi dataset/mcp/api-rest, URL réelles uniquement). " +
  "Une carte « Appliquer la configuration » s'affiche alors : le créateur valide en un clic et tout est appliqué au gent (nom, prompt, modèles, connecteurs…). " +
  "Règles impératives : n'annonce JAMAIS que tu configures ou vas configurer quelque chose sans émettre ce bloc dans le MÊME message ; si le créateur accepte verbalement une proposition faite plus tôt, ré-émets immédiatement le bloc GENT_CONFIG complet correspondant ; ne renvoie jamais le créateur vers une configuration manuelle (onglets, listes déroulantes) pour ce que ce bloc sait faire.";

const VALID_MODEL_IDS = new Set(MODEL_CATALOG.map((m) => m.id));

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
}

function validateConnector(c: unknown): GentConfigConnector | null {
  const p = c as Partial<GentConfigConnector>;
  if (!p || typeof p.name !== "string" || typeof p.url !== "string") return null;
  if (!["dataset", "mcp", "api-rest"].includes(p.kind as string)) return null;
  if (p.kind === "dataset" && !parseDatasetUrl(p.url)) return null;
  if (p.kind !== "dataset" && !/^https?:\/\//.test(p.url)) return null;
  return { kind: p.kind as GentConfigConnector["kind"], name: p.name, url: p.url };
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
    };
    if (Object.values(candidate).some((v) => v !== undefined)) config = candidate;
  } catch {
    // bloc malformé — ignoré
  }

  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), config };
}
