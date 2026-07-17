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

/** Connecteur candidat identifié par recherche web, avec évaluation. */
export interface ConnectorSuggestion {
  kind: "dataset" | "mcp" | "api-rest";
  name: string;
  url: string;
  description: string;
  /** Évaluation sécurité : authentification, sensibilité des données, HTTPS… */
  security: string;
  /** Évaluation stabilité : source officielle, fraîcheur, garanties de service… */
  stability: string;
}

const CONNECTORS_LIST_RE = /<!--CONNECTORS:\s*(\[[\s\S]*?\])\s*-->/;

export const CONNECTOR_DISCOVERY_INSTRUCTION =
  "Dès que le créateur décrit l'objectif de son gent (même sans URL), utilise la recherche web pour identifier des connecteurs disponibles qui augmenteraient l'expérience utilisateur : jeux de données ouverts (portails Opendatasoft comme opendata.paris.fr, data.gouv.fr…), serveurs MCP publics, API publiques pertinentes. " +
  "Présente brièvement tes trouvailles dans ta réponse, puis termine (sur sa propre ligne) par un bloc " +
  '<!--CONNECTORS: [{"kind":"dataset","name":"Nom lisible","url":"https://…","description":"Ce que le connecteur apporte au gent, en une phrase","security":"Évaluation courte : accès public/authentifié, HTTPS, sensibilité des données","stability":"Évaluation courte : source officielle ou non, fraîcheur des données, fiabilité"}]--> ' +
  '("kind" parmi "dataset" pour un portail Opendatasoft, "mcp" pour un serveur MCP, "api-rest" pour une autre API ; 1 à 4 entrées maximum, uniquement des URL réelles trouvées ou connues — jamais inventées). ' +
  "Une liste de sélection s'affiche alors : le créateur choisit les connecteurs à configurer automatiquement. Ne lui demande jamais de configuration manuelle. " +
  "N'inclus pas les connecteurs déjà configurés. Si tu n'as rien trouvé de fiable, n'émets pas le bloc.";

export const REST_API_MANUAL_INSTRUCTION =
  "Tu peux brancher toi-même N'IMPORTE QUELLE API REST (ex. SerpApi Google Flights) pour le créateur : URL de base, méthode (GET/POST), paramètres fixes (ex. engine=google_flights), clé API en en-tête ou en paramètre de requête, et paramètres remplis dynamiquement par le gent à chaque appel (ex. departure_id, arrival_id, outbound_date). " +
  "Quand le créateur veut connecter une API précise (il colle une URL/doc ou demande « configure le connecteur pour moi »), ne réponds JAMAIS que la plateforme ne le permet pas, que cela nécessite un développement, ni que « la carte va apparaître » sans agir : tu DOIS émettre, dans le MÊME message, un bloc GENT_CONFIG contenant un connecteur {\"kind\":\"api-rest\", \"name\":\"…\", \"restConfig\":{…}} entièrement rempli (method, baseUrl, description, queryParams, auth avec value \"env:NOM_DE_VARIABLE\" pour toute clé secrète, modelParams). " +
  "C'est ce bloc qui fait apparaître la carte « Appliquer la configuration » : sans lui, aucune carte ne s'affiche. Résume tes choix en quelques puces courtes dans le texte visible, mais mets toujours la configuration complète dans le bloc. " +
  "IMPORTANT — sois toujours explicite sur ce qu'il reste à faire au créateur APRÈS avoir appliqué la configuration, sous forme d'étapes numérotées claires. En particulier, s'il faut fournir une clé API : tu ne connais jamais la vraie clé, tu mets seulement value \"env:NOM_DE_VARIABLE\" dans la config ; indique donc précisément (1) où obtenir la clé (le site du fournisseur), (2) comment la fournir — soit la coller directement dans le champ « Clé d'API » du connecteur via l'onglet Connecteurs → bouton « ✏️ Modifier la configuration » (pratique pour tester, la clé reste dans le navigateur), soit définir la variable d'environnement NOM_DE_VARIABLE côté serveur (recommandé pour un vrai secret), (3) qu'il faut publier (ou republier) le gent pour appliquer, puis tester. " +
  "Précise que l'API sera réellement appelée par le gent une fois la clé fournie et le gent publié. " +
  "Le créateur peut aussi tout faire à la main dans l'onglet Connecteurs (« + Ajouter un connecteur » → « API REST ») : ne l'y renvoie que s'il le demande explicitement.";

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

function validateSuggestion(parsed: unknown): ConnectorSuggestion | null {
  const p = parsed as Partial<ConnectorSuggestion>;
  if (!p || typeof p.name !== "string" || typeof p.url !== "string") return null;
  if (!["dataset", "mcp", "api-rest"].includes(p.kind as string)) return null;
  if (p.kind === "dataset" && !parseDatasetUrl(p.url)) return null;
  if (p.kind !== "dataset" && !/^https:\/\//.test(p.url)) return null;
  return {
    kind: p.kind as ConnectorSuggestion["kind"],
    name: p.name,
    url: p.url,
    description: typeof p.description === "string" ? p.description : "",
    security: typeof p.security === "string" ? p.security : "Non évaluée",
    stability: typeof p.stability === "string" ? p.stability : "Non évaluée",
  };
}

/** Extrait la liste de connecteurs candidats identifiés par recherche web. */
export function extractConnectorSuggestions(raw: string): { text: string; suggestions: ConnectorSuggestion[] } {
  const match = raw.match(CONNECTORS_LIST_RE);
  if (!match) return { text: raw, suggestions: [] };
  let suggestions: ConnectorSuggestion[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      suggestions = parsed.map(validateSuggestion).filter((s): s is ConnectorSuggestion => s !== null).slice(0, 4);
    }
  } catch {
    // bloc malformé — ignoré
  }
  const start = match.index ?? 0;
  return { text: (raw.slice(0, start) + raw.slice(start + match[0].length)).trim(), suggestions };
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
