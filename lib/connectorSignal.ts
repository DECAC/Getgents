// Auto-configuration de connecteur par l'assistant du builder : quand le
// créateur colle une URL de dataset open data ou de serveur MCP, l'assistant
// (ou une détection déterministe côté client, en secours) émet une
// proposition de connecteur — ajoutée seulement après validation du créateur.
import { parseDatasetUrl } from "@/lib/opendatasoft";

const CONNECTOR_RE = /<!--CONNECTOR:\s*(\{[\s\S]*?\})\s*-->/;

export interface ConnectorProposal {
  kind: "dataset" | "mcp";
  name: string;
  url: string;
}

export const CONNECTOR_PROMPT_INSTRUCTION =
  "Si le message du créateur contient l'URL d'un jeu de données ouvert (portail Opendatasoft : opendata.paris.fr, data.gouv.fr… — chemin /explore/dataset/<id>) ou d'un serveur MCP, configure le connecteur à sa place : termine ta réponse (sur sa propre ligne) par exactement un bloc " +
  '<!--CONNECTOR: {"kind":"dataset","name":"Nom lisible du connecteur","url":"https://…"}--> ' +
  '(ou "kind":"mcp" pour un serveur MCP). Choisis un nom court et parlant d\'après le contexte. ' +
  "Une carte de validation s'affiche alors : dis simplement au créateur que tu as préparé le connecteur et qu'il n'a qu'à le valider — ne lui demande jamais de le configurer manuellement. " +
  "N'émets pas ce bloc si un connecteur équivalent est déjà configuré.";

function validate(parsed: unknown): ConnectorProposal | null {
  const p = parsed as { kind?: unknown; name?: unknown; url?: unknown };
  if (!p || typeof p.name !== "string" || typeof p.url !== "string") return null;
  if (p.kind === "dataset" && parseDatasetUrl(p.url)) return { kind: "dataset", name: p.name, url: p.url };
  if (p.kind === "mcp" && /^https?:\/\//.test(p.url)) return { kind: "mcp", name: p.name, url: p.url };
  return null;
}

export function extractConnectorSignal(raw: string): { text: string; connector: ConnectorProposal | null } {
  const match = raw.match(CONNECTOR_RE);
  if (!match) return { text: raw, connector: null };
  let connector: ConnectorProposal | null = null;
  try {
    connector = validate(JSON.parse(match[1]));
  } catch {
    // bloc malformé — ignoré
  }
  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), connector };
}

/**
 * Détection déterministe de secours : si le message du créateur contient une
 * URL de dataset Opendatasoft, on propose le connecteur même si le modèle a
 * oublié d'émettre le bloc CONNECTOR.
 */
export function detectConnectorInText(text: string): ConnectorProposal | null {
  const urlMatch = text.match(/https?:\/\/[^\s<>"')]+/);
  if (!urlMatch) return null;
  const ref = parseDatasetUrl(urlMatch[0]);
  if (ref) {
    return { kind: "dataset", name: `Dataset ${ref.datasetId}`, url: urlMatch[0] };
  }
  return null;
}
