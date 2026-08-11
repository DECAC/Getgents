import type { Espace, EspacesMap, Tool, UserFile, RestApiConnector } from "@/lib/types";
import type { GentDraft, KnowledgeSource } from "@/lib/types/builder";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
import { formatConversationStartedAt, newConversationId } from "@/lib/conversationUtils";
import { parseDatasetUrl } from "@/lib/opendatasoft";
import { appAccessHeaders } from "@/lib/appAccess";
import { MAX_CHARS as DOC_MAX_CHARS } from "@/lib/extractDocumentText";
import { resolveImageModelId } from "@/lib/imageModels";

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

/** À appeler quand la clé APP_ACCESS_SECRET est (re)saisie — relance les syncs. */
export function resetPublishedRemoteAvailability(): void {
  remoteAvailable = null;
}

/** Récupère les gents publiés depuis le serveur — null si indisponible, 'unauthorized' si 401. */
export async function fetchRemoteGents(): Promise<EspacesMap | null | "unauthorized"> {
  if (remoteAvailable === false) return null;
  try {
    const res = await fetch("/api/gents", {
      cache: "no-store",
      credentials: "include",
      headers: appAccessHeaders(),
    });
    if (res.status === 401) {
      remoteAvailable = false;
      return "unauthorized";
    }
    if (res.status === 503) {
      // Supabase non configuré — cache local uniquement.
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

function sendRemoteGent(id: string, espace: Espace, diffuse = false): Promise<void> {
  return fetch(`/api/gents/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...appAccessHeaders() },
    body: JSON.stringify({ espace, ...(diffuse ? { diffuse: true } : {}) }),
    // Survit à une navigation immédiate (clic sur « Preview » juste après la
    // publication) : sans ça la requête est annulée par le déchargement.
    keepalive: true,
  })
    .then(async (res) => {
      if (res.status === 503 || res.status === 401) remoteAvailable = false;
      else if (res.ok) remoteAvailable = true;
      else if (diffuse) {
        // Une diffusion qui échoue en silence est le pire cas : le créateur
        // croit son gent à jour alors que ses destinataires lisent toujours
        // l'ancienne version. Cause la plus fréquente : la migration 004
        // (colonne `diffused`) pas encore exécutée sur la base.
        const detail = await res.text().catch(() => "");
        console.error(
          `[Getgents] Diffusion refusée par le serveur (${res.status}). La version diffusée n'a PAS été mise à jour.`,
          detail.slice(0, 300)
        );
      }
    })
    .catch(() => {
      // Réseau indisponible : le cache localStorage garde la donnée, le
      // prochain writePublishedGent retentera.
    });
}

function pushRemoteGent(id: string, espace: Espace, immediate = false, diffuse = false): void {
  if (remoteAvailable === false) return;
  const pending = pushTimers.get(id);
  if (pending) clearTimeout(pending);

  // Publication : on envoie tout de suite. Le débounce était ici une cause de
  // perte de données — le lien « Preview » est une navigation pleine page, qui
  // détruisait le timer avant son déclenchement ; l'espace rechargeait alors la
  // version précédente depuis le serveur et écrasait la nouvelle.
  if (immediate) {
    pushTimers.delete(id);
    void sendRemoteGent(id, espace, diffuse);
    return;
  }

  // Débounce par gent : l'état de l'espace change à chaque frappe/message,
  // on n'envoie au serveur que la version stabilisée.
  pushTimers.set(
    id,
    setTimeout(() => {
      pushTimers.delete(id);
      void sendRemoteGent(id, espace, diffuse);
    }, PUSH_DEBOUNCE_MS)
  );
}

/**
 * `diffuse` fige en plus la version servie aux destinataires (liens de
 * partage, iframe, WhatsApp, routines). Sans lui, on n'écrit que la version
 * de travail : le créateur peut donc tester en Preview sans rien changer
 * pour les utilisateurs déjà en place.
 */
export function writePublishedGent(id: string, espace: Espace, immediate = false, diffuse = false): void {
  if (typeof window === "undefined") return;
  const current = readPublishedGents();
  current[id] = espace;
  writeLocalCache(current);
  pushRemoteGent(id, espace, immediate, diffuse);
}

/**
 * Hydratation au chargement : fusionne le distant (source de vérité) par-dessus
 * le cache local, met le cache à jour, et renvoie la map fusionnée — ou null si
 * le distant est indisponible (le cache local reste alors la seule source).
 */
export async function syncPublishedGentsFromRemote(): Promise<EspacesMap | null | "unauthorized"> {
  const remote = await fetchRemoteGents();
  if (remote === "unauthorized") return "unauthorized";
  if (remote === null) return null;

  const local = readPublishedGents();
  const merged: EspacesMap = { ...local };
  const stale: string[] = [];

  for (const [id, remoteEspace] of Object.entries(remote)) {
    const localEspace = local[id];
    // Le distant fait autorité, SAUF s'il est en retard d'une publication : une
    // version locale plus récente signifie que le push n'a pas encore abouti.
    // Sans ce garde-fou, republier puis ouvrir l'espace aussitôt ramenait la
    // configuration précédente (nouveaux champs d'entrée invisibles).
    if (localEspace && (localEspace.version ?? 1) > (remoteEspace.version ?? 1)) {
      stale.push(id);
      continue;
    }
    merged[id] = remoteEspace;
  }

  writeLocalCache(merged);

  // Réconciliation : gents absents du serveur (publiés hors ligne ou avant la
  // config Supabase) et versions locales en avance remontent vers le serveur.
  for (const [id, espace] of Object.entries(merged)) {
    if (!(id in remote) || stale.includes(id)) pushRemoteGent(id, espace, true);
  }
  return merged;
}

/**
 * Supprime un gent publié : cache local retiré immédiatement, puis suppression
 * serveur (qui nettoie aussi ses liens de partage — voir DELETE /api/gents/[id]).
 * Contrairement aux écritures, c'est une action explicite de l'utilisateur :
 * on attend la réponse pour pouvoir signaler un échec, plutôt que de supposer
 * que ça a marché.
 */
export async function deletePublishedGent(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "unavailable" };

  const pending = pushTimers.get(id);
  if (pending) {
    clearTimeout(pending);
    pushTimers.delete(id);
  }
  const current = readPublishedGents();
  delete current[id];
  writeLocalCache(current);

  if (remoteAvailable === false) return { ok: true };
  try {
    const res = await fetch(`/api/gents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: appAccessHeaders(),
    });
    if (res.status === 503 || res.status === 401) {
      remoteAvailable = false;
      return { ok: true };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { error?: string });
      return { ok: false, error: data.error ?? String(res.status) };
    }
    remoteAvailable = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Met à jour le nom affiché côté utilisateur sans effacer conversations ni artefacts. */
export function patchPublishedGentName(id: string, name: string): void {
  if (typeof window === "undefined") return;
  const existing = readPublishedGents()[id];
  if (!existing) return;
  writePublishedGent(id, { ...existing, name, gent: name });
}

/**
 * Total de caractères de base de connaissance injectés dans le prompt système.
 * Aligné sur un dossier d'environ 100 pages (voir `MAX_CHARS` d'extraction) :
 * un unique document au plafond d'extraction doit tenir intégralement, sans
 * être écarté « faute de place » à la publication. Au-delà (plusieurs gros
 * fichiers), les suivants sont listés en référence seule.
 */
export const KNOWLEDGE_BASE_BUDGET = DOC_MAX_CHARS;

/**
 * Injecte le CONTENU des sources de connaissance déclarées par le créateur,
 * pas seulement leur nom. Baké dans le systemPrompt à la publication — c'est
 * là que vivent déjà tous les autres réglages figés du créateur (connecteurs,
 * recherche web…) ; Espace.files reste réservé aux documents de l'utilisateur
 * final, jamais à la base de connaissance du créateur.
 *
 * Repli en référence seule (nom listé, contenu absent) pour les sources sans
 * texte extrait : liens (kind "url", jamais récupérés côté serveur), fichiers
 * dont l'extraction a échoué, ou budget total dépassé.
 */
function knowledgeBaseBlock(sources: KnowledgeSource[]): string {
  if (!sources.length) return "";

  const withText = sources.filter((s) => (s.text ?? "").trim() !== "");
  const refsOnly = sources.filter((s) => !(s.text ?? "").trim());

  const parts: string[] = [];
  const omitted: string[] = [];
  let used = 0;
  for (const s of withText) {
    const body = s.text!.trim();
    if (used + body.length > KNOWLEDGE_BASE_BUDGET) {
      omitted.push(s.label);
      continue;
    }
    used += body.length;
    parts.push(`--- ${s.label}${s.truncated ? " (extrait tronqué)" : ""} ---\n${body}`);
  }

  let block = "";
  if (parts.length) {
    block +=
      "\n\nBASE DE CONNAISSANCE DÉCLARÉE PAR LE CRÉATEUR — contenu intégral ci-dessous, à utiliser comme " +
      `source primaire de tes réponses :\n${parts.join("\n\n")}`;
  }

  const refLabels = [
    ...refsOnly.map((s) => `${s.kind} : ${s.label}`),
    ...omitted.map((l) => `file : ${l} (non inclus faute de place)`),
  ];
  if (refLabels.length) {
    block += `\n\nAutres références déclarées (nom seulement, contenu non accessible) :\n${refLabels
      .map((r) => `- ${r}`)
      .join("\n")}`;
  }
  return block;
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

  // Type « visionneuse » : le document fixé par le créateur nourrit aussi la
  // conversation (même mécanisme que les fichiers joints — voir
  // sessionContext.ts) et devient un artefact d'accueil pour que l'espace
  // s'ouvre directement dessus (voir EspaceContext, visionneuseMode).
  const visionneuseDoc = draft.visionneuse?.enabled ? draft.visionneuse.document : undefined;
  if (visionneuseDoc) {
    files.push({
      id: "visionneuse-doc-file",
      name: visionneuseDoc.sourceName,
      size: `${visionneuseDoc.pageCount} page${visionneuseDoc.pageCount > 1 ? "s" : ""}`,
      date: "Visionneuse",
      text: visionneuseDoc.pages.join("\n\n"),
      truncated: visionneuseDoc.truncated,
    });
  }

  // Blocs ajoutés par la plateforme (base de connaissance, formats d'artefact,
  // modes d'emploi des connecteurs). Ils sont accumulés ICI puis placés AVANT
  // le prompt du créateur : empilés après lui, comme auparavant, ils
  // occupaient la dernière position — celle que le modèle lit comme faisant
  // autorité — et son style (longueur, ton) passait au second plan derrière
  // des consignes purement techniques.
  const platformBlocks: string[] = [];
  platformBlocks.push(knowledgeBaseBlock(draft.knowledgeSources));

  if (visionneuseDoc) {
    const instructions = draft.visionneuse?.instructions?.trim();
    platformBlocks.push(
      `Ce gent est une VISIONNEUSE DE DOCUMENT : l'utilisateur lit « ${visionneuseDoc.sourceName} » (${visionneuseDoc.pageCount} pages) ouvert en pleine page à côté de la conversation. ` +
        "Ton rôle est d'accompagner cette lecture — résume, explique, répond sur le contenu réel du document (fourni ci-dessous en base de connaissance), et propose un artefact (rapport, graphique, image) quand ça aide à mieux comprendre une section. " +
        "Ne propose jamais d'ouvrir un AUTRE document : celui-ci est fixé par le créateur." +
        (instructions ? `\n\nConsignes du créateur : ${instructions}` : "")
    );
  }

  // Tous les artefacts (rapport, checklist, graphique, aperçu visuel, carte) sont éligibles
  // pour tous les gents — pas de configuration côté créateur. Le modèle décide seul, au fil de
  // la conversation, quand un artefact concret apporte de la valeur (voir ARTEFACT_PROMPT_INSTRUCTION,
  // toujours injectée côté chat dans EspaceContext).
  platformBlocks.push(
    "Génère des artefacts (rapport, checklist, graphique, aperçu visuel, carte, image, résumé de profil) automatiquement et intelligemment, uniquement quand le contenu de la conversation s'y prête — n'attends jamais qu'on te le demande explicitement, et ne les propose pas non plus systématiquement hors de propos. " +
      "L'utilisateur décide s'il ajoute chaque proposition à son espace de travail. " +
      "Pour les illustrations (générées ou photos web), demande toujours son autorisation avant production."
  );

  const threadId = newConversationId();
  const chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? undefined;
  // Les consignes IMAGE sont injectées à l'exécution (buildGentSystemPrompt)
  // selon imageModelId / webSearch — pas bakées dans le prompt système.
  // resolveImageModelId corrige l'ancien slug google/nanobanana à la publication.
  const rawImageModelId = draft.modelAssignments.find((a) => a.capability === "image")?.modelId ?? undefined;
  const imageModelId = rawImageModelId ? resolveImageModelId(rawImageModelId) : undefined;

  // Les connecteurs MCP dont le détail est une URL deviennent de vrais
  // serveurs d'outils côté chat (transport Streamable HTTP, ex. datagouv).
  const mcpServers = draft.connectors
    .filter((c) => c.toolKind === "mcp" && typeof c.detail === "string" && /^https?:\/\//.test(c.detail))
    .map((c) => ({ name: c.name, url: c.detail as string }));

  if (draft.webSearch) {
    platformBlocks.push(
      "La recherche web est activée pour cet espace : tes réponses peuvent s'appuyer sur des résultats web récents. Cite tes sources quand tu utilises une information issue du web."
    );
  }

  if (mcpServers.length) {
    platformBlocks.push(
      `Tu disposes d'outils temps réel via ${mcpServers.length > 1 ? "les serveurs MCP" : "le serveur MCP"} ${mcpServers.map((s) => s.name).join(", ")}. ` +
        "Utilise-les dès que la question porte sur des données qu'ils couvrent, plutôt que de répondre de mémoire, et cite la source des données obtenues."
    );
  }

  // Les connecteurs « dataset » deviennent des outils de recherche par
  // proximité (API Opendatasoft) exécutés côté serveur dans /api/chat.
  const datasets = draft.connectors
    .filter((c) => c.toolKind === "dataset" && typeof c.detail === "string" && parseDatasetUrl(c.detail) !== null)
    .map((c) => ({ name: c.name, url: c.detail as string }));

  if (datasets.length) {
    platformBlocks.push(
      `Tu disposes d'outils sur des jeux de données ouvertes : ${datasets.map((d) => d.name).join(", ")}. ` +
      "Deux modes selon le dataset : (1) géolocalisé — recherche par proximité GPS, demande la position via GEOLOC_REQUEST si besoin ; " +
      "(2) tabulaire (ex. DVF transactions immobilières) — interroge par filtres (code INSEE commune, département, type de bien, surface, prix) sans demander la géolocalisation. " +
      "Pour une commune, utilise le code INSEE à 5 chiffres (pas le code postal). " +
      "Pour les datasets géolocalisés, rends chaque adresse cliquable : <a href=\"geo:LAT,LON\" data-address=\"ADRESSE\">ADRESSE</a>. " +
        "Propose un artefact carte quand plusieurs lieux géolocalisés sont pertinents."
    );
  }

  // Connecteur IDFM PRIM : deux outils transit temps réel côté serveur.
  const prim = draft.connectors.some((c) => c.toolKind === "prim");
  if (prim) {
    platformBlocks.push(
      "Tu disposes des outils temps réel Île-de-France Mobilités (PRIM) : prim_stops_nearby(lat, lon) pour trouver les arrêts autour d'une position, puis prim_next_departures(stop_id) pour les prochains passages. " +
      "Pour guider vers un transport : obtiens d'abord une position (géolocalisation consentie ou lieu précis fourni), appelle prim_stops_nearby, confirme le nom de l'arrêt retenu, puis appelle prim_next_departures avec son stop_id. " +
        "Présente chaque passage : « Ligne [X] → [direction] : HH:MM » en précisant si l'horaire est temps réel ou théorique (champ temps_reel). N'invente jamais un horaire."
    );
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
    platformBlocks.push(
      `Tu disposes de connecteurs API REST configurés par le créateur : ${listed}. ` +
      "Appelle l'outil correspondant dès que la question relève de son domaine, en renseignant ses paramètres à partir de la demande de l'utilisateur (demande les informations manquantes avant d'appeler). " +
      "Renseigne CHAQUE paramètre avec une valeur normalisée et valide pour l'API — un nom de ville ou de région seul, un code, une date au format attendu — et NE recopie JAMAIS mot pour mot une phrase de l'utilisateur (ex. « toute la France avec télétravail » n'est pas une localisation valide : utilise une ville précise, ou laisse le paramètre optionnel vide pour une recherche nationale). " +
      "Si un appel échoue, LIS le message d'erreur (il indique l'URL réellement appelée et le motif) : corrige la valeur des paramètres fautifs ou retire les paramètres optionnels douteux AVANT de réessayer — ne relance jamais deux fois le même appel à l'identique. " +
        "Fonde ta réponse uniquement sur les données réellement renvoyées par l'API — n'invente jamais un résultat. Si l'appel échoue durablement, explique-le clairement."
    );
  }

  // Connecteur Powens (sandbox) : comptes & transactions bancaires de test.
  const powens = draft.connectors.some((c) => c.toolKind === "powens");
  if (powens) {
    platformBlocks.push(
      "Tu disposes des outils bancaires Powens (MODE SANDBOX — données de test, jamais de vraies données) : powens_accounts() pour lister les comptes et soldes, powens_transactions(min_date?, limit?) pour l'historique de transactions. " +
      "Analyse uniquement les données renvoyées par ces outils — n'invente jamais une transaction ni un montant. Masque tout identifiant de compte sensible (ex. FR76****1234). " +
        "Si les outils renvoient une erreur de configuration ou zéro compte, explique que le créateur doit configurer les variables POWENS_* côté serveur puis lier une banque sandbox via l'onglet Connecteurs."
    );
  }

  const gmail = draft.connectors.some((c) => c.toolKind === "gmail");
  if (gmail) {
    platformBlocks.push(
      "Tu disposes des outils Gmail du compte Google connecté par le créateur : gmail_search(query?, maxResults?) pour rechercher des messages, gmail_get_message(messageId) pour lire un message, gmail_send(to, subject, body) pour envoyer un e-mail. " +
      "Ne cite que les e-mails réellement renvoyés par ces outils — n'invente jamais un message. Respecte la confidentialité : ne répète pas inutilement des adresses ou contenus sensibles. " +
      "Avant d'envoyer un e-mail avec gmail_send, demande TOUJOURS une confirmation explicite de l'utilisateur. " +
      "Si Gmail n'est pas connecté ou renvoie une erreur, indique que le créateur doit cliquer sur « Connecter un compte Google » dans l'onglet Connecteurs du studio."
    );
  }

  // Le prompt du créateur FERME le message : c'est sa consigne qui gouverne.
  const systemPrompt = [...platformBlocks.map((b) => b.trim()).filter(Boolean), draft.systemPrompt.trim()]
    .filter(Boolean)
    .join("\n\n");

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
    artefacts: visionneuseDoc
      ? [
          {
            id: "visionneuse-doc",
            title: visionneuseDoc.sourceName,
            type: "Visionneuse de document",
            icon: "📖",
            date: "Document du gent",
            document: visionneuseDoc,
          },
        ]
      : [],
    systemPrompt,
    chatModelId,
    imageModelId,
    mcpServers: mcpServers.length ? mcpServers : undefined,
    datasets: datasets.length ? datasets : undefined,
    prim: prim || undefined,
    powens: powens || undefined,
    gmail: gmail || undefined,
    restApis: restApis.length ? restApis : undefined,
    jumpForm: draft.jumpForm,
    routine: draft.routine,
    channel: draft.channel,
    pinnedArtefact: draft.pinnedArtefact,
    visionneuse: draft.visionneuse,
    webSearch: draft.webSearch || undefined,
  };
}
