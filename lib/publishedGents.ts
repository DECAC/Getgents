import type { Espace, EspacesMap, Tool, UserFile, RestApiConnector } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
import { formatConversationStartedAt, newConversationId } from "@/lib/conversationUtils";
import { parseDatasetUrl } from "@/lib/opendatasoft";

// Persistance des gents publiés : la source de vérité est Supabase (via les
// routes /api/gents), le localStorage n'est plus qu'un cache local pour un
// affichage instantané et un mode dégradé. Si Supabase n'est pas configuré
// (variables d'env absentes → l'API répond 503), on retombe silencieusement
// sur le comportement maquette d'origine : localStorage seul.
const STORAGE_KEY = "getgents:published-gents";

export function readPublishedGents(): EspacesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EspacesMap) : {};
  } catch {
    return {};
  }
}

function writeLocalCache(gents: EspacesMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gents));
  } catch {
    // localStorage indisponible (navigation privée, quota dépassé…).
  }
}

// --- Synchronisation distante -------------------------------------------

// null = pas encore sondé ; false = API absente/non configurée (on arrête
// d'essayer pour la session) ; true = distant opérationnel.
let remoteAvailable: boolean | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 1500;

/** Récupère les gents publiés depuis le serveur — null si indisponible. */
export async function fetchRemoteGents(): Promise<EspacesMap | null> {
  if (remoteAvailable === false) return null;
  try {
    const res = await fetch("/api/gents", { cache: "no-store" });
    if (res.status === 503) {
      remoteAvailable = false;
      return null;
    }
    if (!res.ok) return null;
    remoteAvailable = true;
    const data = (await res.json()) as { gents?: EspacesMap };
    return data.gents ?? {};
  } catch {
    return null;
  }
}

function pushRemoteGent(id: string, espace: Espace): void {
  if (remoteAvailable === false) return;
  // Débounce par gent : l'état de l'espace change à chaque frappe/message,
  // on n'envoie au serveur que la version stabilisée.
  const pending = pushTimers.get(id);
  if (pending) clearTimeout(pending);
  pushTimers.set(
    id,
    setTimeout(() => {
      pushTimers.delete(id);
      fetch(`/api/gents/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espace }),
      })
        .then((res) => {
          if (res.status === 503) remoteAvailable = false;
          else if (res.ok) remoteAvailable = true;
        })
        .catch(() => {
          // Réseau indisponible : le cache localStorage garde la donnée, le
          // prochain writePublishedGent retentera.
        });
    }, PUSH_DEBOUNCE_MS)
  );
}

export function writePublishedGent(id: string, espace: Espace): void {
  if (typeof window === "undefined") return;
  const current = readPublishedGents();
  current[id] = espace;
  writeLocalCache(current);
  pushRemoteGent(id, espace);
}

/**
 * Hydratation au chargement : fusionne le distant (source de vérité) par-dessus
 * le cache local, met le cache à jour, et renvoie la map fusionnée — ou null si
 * le distant est indisponible (le cache local reste alors la seule source).
 */
export async function syncPublishedGentsFromRemote(): Promise<EspacesMap | null> {
  const remote = await fetchRemoteGents();
  if (remote === null) return null;
  const merged = { ...readPublishedGents(), ...remote };
  writeLocalCache(merged);
  // Réconciliation : les gents présents uniquement en local (publiés hors
  // ligne ou avant la config Supabase) remontent vers le serveur.
  for (const [id, espace] of Object.entries(merged)) {
    if (!(id in remote)) pushRemoteGent(id, espace);
  }
  return merged;
}

/** Met à jour le nom affiché côté utilisateur sans effacer conversations ni artefacts. */
export function patchPublishedGentName(id: string, name: string): void {
  if (typeof window === "undefined") return;
  const existing = readPublishedGents()[id];
  if (!existing) return;
  writePublishedGent(id, { ...existing, name, gent: name });
}

export function draftToEspace(draft: GentDraft): Espace {
  // Le modèle d'outils du builder (8 types génériques configurables : MCP,
  // API REST, connecteur personnalisé…) ne porte plus de catégorie
  // lecture / écriture / compte-tiers — on les affiche par défaut en lecture
  // seule côté espace ; aucun de ces types génériques ne déclenche
  // l'invariant de connexion réservé aux comptes tiers.
  const tools: Tool[] = draft.connectors.map((c) => {
    const type = CONNECTOR_TOOL_TYPES.find((t) => t.kind === c.toolKind);
    return {
      id: c.id,
      name: c.name,
      category: "lecture",
      icon: type?.icon ?? "🔌",
      desc: c.detail || type?.description || "",
      connectable: false,
      connected: true,
    };
  });

  const files: UserFile[] = draft.knowledgeSources.map((s) => ({
    id: s.id,
    name: s.label,
    size: s.meta,
    date: "Base de connaissance",
  }));

  let systemPrompt = draft.systemPrompt.trim();

  if (draft.knowledgeSources.length) {
    const refs = draft.knowledgeSources.map((s) => `- ${s.kind} : ${s.label}`).join("\n");
    systemPrompt += `\n\nBase de connaissance déclarée par le créateur (références seulement — leur contenu n'est pas analysé automatiquement dans cette maquette) :\n${refs}`;
  }

  // Tous les artefacts (rapport, checklist, graphique, aperçu visuel, carte) sont éligibles
  // pour tous les gents — pas de configuration côté créateur. Le modèle décide seul, au fil de
  // la conversation, quand un artefact concret apporte de la valeur (voir ARTEFACT_PROMPT_INSTRUCTION,
  // toujours injectée côté chat dans EspaceContext).
  systemPrompt +=
    "\n\nGénère des artefacts (rapport, checklist, graphique, aperçu visuel, carte) automatiquement et intelligemment, uniquement quand le contenu de la conversation s'y prête — n'attends jamais qu'on te le demande explicitement, et ne les propose pas non plus systématiquement hors de propos. " +
    "L'utilisateur décide s'il ajoute chaque proposition à son espace de travail.";

  const threadId = newConversationId();
  const chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? undefined;

  // Les connecteurs MCP dont le détail est une URL deviennent de vrais
  // serveurs d'outils côté chat (transport Streamable HTTP, ex. datagouv).
  const mcpServers = draft.connectors
    .filter((c) => c.toolKind === "mcp" && typeof c.detail === "string" && /^https?:\/\//.test(c.detail))
    .map((c) => ({ name: c.name, url: c.detail as string }));

  if (draft.webSearch) {
    systemPrompt +=
      "\n\nLa recherche web est activée pour cet espace : tes réponses peuvent s'appuyer sur des résultats web récents. Cite tes sources quand tu utilises une information issue du web.";
  }

  if (mcpServers.length) {
    systemPrompt +=
      `\n\nTu disposes d'outils temps réel via ${mcpServers.length > 1 ? "les serveurs MCP" : "le serveur MCP"} ${mcpServers.map((s) => s.name).join(", ")}. ` +
      "Utilise-les dès que la question porte sur des données qu'ils couvrent, plutôt que de répondre de mémoire, et cite la source des données obtenues.";
  }

  // Les connecteurs « dataset » deviennent des outils de recherche par
  // proximité (API Opendatasoft) exécutés côté serveur dans /api/chat.
  const datasets = draft.connectors
    .filter((c) => c.toolKind === "dataset" && typeof c.detail === "string" && parseDatasetUrl(c.detail) !== null)
    .map((c) => ({ name: c.name, url: c.detail as string }));

  if (datasets.length) {
    systemPrompt +=
      `\n\nTu disposes d'outils sur des jeux de données ouvertes : ${datasets.map((d) => d.name).join(", ")}. ` +
      "Deux modes selon le dataset : (1) géolocalisé — recherche par proximité GPS, demande la position via GEOLOC_REQUEST si besoin ; " +
      "(2) tabulaire (ex. DVF transactions immobilières) — interroge par filtres (code INSEE commune, département, type de bien, surface, prix) sans demander la géolocalisation. " +
      "Pour une commune, utilise le code INSEE à 5 chiffres (pas le code postal). " +
      "Pour les datasets géolocalisés, rends chaque adresse cliquable : <a href=\"geo:LAT,LON\" data-address=\"ADRESSE\">ADRESSE</a>. " +
      "Propose un artefact carte quand plusieurs lieux géolocalisés sont pertinents.";
  }

  // Connecteur IDFM PRIM : deux outils transit temps réel côté serveur.
  const prim = draft.connectors.some((c) => c.toolKind === "prim");
  if (prim) {
    systemPrompt +=
      "\n\nTu disposes des outils temps réel Île-de-France Mobilités (PRIM) : prim_stops_nearby(lat, lon) pour trouver les arrêts autour d'une position, puis prim_next_departures(stop_id) pour les prochains passages. " +
      "Pour guider vers un transport : obtiens d'abord une position (géolocalisation consentie ou lieu précis fourni), appelle prim_stops_nearby, confirme le nom de l'arrêt retenu, puis appelle prim_next_departures avec son stop_id. " +
      "Présente chaque passage : « Ligne [X] → [direction] : HH:MM » en précisant si l'horaire est temps réel ou théorique (champ temps_reel). N'invente jamais un horaire.";
  }

  // Connecteurs API REST personnalisés : appels HTTP réels côté serveur, avec
  // paramètres fixes, clé API et paramètres remplis par le modèle.
  const restApis: RestApiConnector[] = draft.connectors
    .filter((c) => c.toolKind === "api-rest" && c.restConfig && /^https?:\/\//.test(c.restConfig.baseUrl))
    .map((c) => ({ name: c.name, config: c.restConfig! }));

  if (restApis.length) {
    const listed = restApis
      .map((r) => {
        const params = (r.config.modelParams ?? []).map((p) => p.name).filter(Boolean);
        const paramNote = params.length ? ` (paramètres : ${params.join(", ")})` : "";
        return `« ${r.name} » — ${r.config.description}${paramNote}`;
      })
      .join(" ; ");
    systemPrompt +=
      `\n\nTu disposes de connecteurs API REST configurés par le créateur : ${listed}. ` +
      "Appelle l'outil correspondant dès que la question relève de son domaine, en renseignant ses paramètres à partir de la demande de l'utilisateur (demande les informations manquantes avant d'appeler). " +
      "Renseigne CHAQUE paramètre avec une valeur normalisée et valide pour l'API — un nom de ville ou de région seul, un code, une date au format attendu — et NE recopie JAMAIS mot pour mot une phrase de l'utilisateur (ex. « toute la France avec télétravail » n'est pas une localisation valide : utilise une ville précise, ou laisse le paramètre optionnel vide pour une recherche nationale). " +
      "Si un appel échoue, LIS le message d'erreur (il indique l'URL réellement appelée et le motif) : corrige la valeur des paramètres fautifs ou retire les paramètres optionnels douteux AVANT de réessayer — ne relance jamais deux fois le même appel à l'identique. " +
      "Fonde ta réponse uniquement sur les données réellement renvoyées par l'API — n'invente jamais un résultat. Si l'appel échoue durablement, explique-le clairement.";
  }

  // Connecteur Powens (sandbox) : comptes & transactions bancaires de test.
  const powens = draft.connectors.some((c) => c.toolKind === "powens");
  if (powens) {
    systemPrompt +=
      "\n\nTu disposes des outils bancaires Powens (MODE SANDBOX — données de test, jamais de vraies données) : powens_accounts() pour lister les comptes et soldes, powens_transactions(min_date?, limit?) pour l'historique de transactions. " +
      "Analyse uniquement les données renvoyées par ces outils — n'invente jamais une transaction ni un montant. Masque tout identifiant de compte sensible (ex. FR76****1234). " +
      "Si les outils renvoient une erreur de configuration ou zéro compte, explique que le créateur doit configurer les variables POWENS_* côté serveur puis lier une banque sandbox via l'onglet Connecteurs.";
  }

  return {
    icon: draft.icon,
    name: draft.name,
    gent: draft.name,
    version: 1,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: draft.connectors.map((c) => ({ label: c.name, action: false })),
    tools,
    tabs: [],
    map: null,
    memory: "",
    conversations: [{ id: threadId, startedAt: formatConversationStartedAt(), messages: [] }],
    activeConversationId: threadId,
    files,
    artefacts: [],
    systemPrompt,
    chatModelId,
    mcpServers: mcpServers.length ? mcpServers : undefined,
    datasets: datasets.length ? datasets : undefined,
    prim: prim || undefined,
    powens: powens || undefined,
    restApis: restApis.length ? restApis : undefined,
    jumpForm: draft.jumpForm,
    webSearch: draft.webSearch || undefined,
  };
}
