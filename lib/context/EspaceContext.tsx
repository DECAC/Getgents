"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type {
  Espace,
  EspacesMap,
  ReservationItem,
  ConversationThread,
  ConversationMessage,
  Artefact,
  ThemeTab,
  ThemeTabProposalAction,
  PinnedRun,
  UserFile,
} from "@/lib/types";
import { sessionContextNote } from "@/lib/sessionContext";
import { ESPACES as INITIAL_ESPACES } from "@/lib/mock-data/espaces";
import {
  formatConversationStartedAt,
  getActiveConversation,
  newConversationId,
} from "@/lib/conversationUtils";
import { extractQuestions, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import { extractArtefactSignal, ARTEFACT_PROMPT_INSTRUCTION } from "@/lib/artefactSignal";
import { extractThemeTabSignal, describeModulesForPrompt, THEME_TAB_PROMPT_INSTRUCTION } from "@/lib/themeTabSignal";
import { extractGeolocRequest, GEOLOC_PROMPT_INSTRUCTION } from "@/lib/geolocSignal";
import { extractProfileSignal, profileContextNote, PROFILE_PROMPT_INSTRUCTION } from "@/lib/profileSignal";
import { readPublishedGents, writePublishedGent, syncPublishedGentsFromRemote } from "@/lib/publishedGents";
import {
  espaceForPinnedRefresh,
  formatApiNetworkError,
} from "@/lib/espaceApiPayload";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion, CHAT_MAX_TOKENS, defaultStatusLabel, humanToolCallLabel } from "@/lib/streamChat";
import { buildJumpFormPrompt } from "@/lib/jumpFormSignal";

const ARTEFACT_KIND_META: Record<string, { type: string; icon: string }> = {
  report: { type: "Rapport", icon: "📄" },
  checklist: { type: "Checklist", icon: "✅" },
  chart: { type: "Graphique", icon: "📊" },
  visual: { type: "Aperçu visuel", icon: "🖼️" },
  map: { type: "Carte", icon: "🗺️" },
  dashboard: { type: "Tableau de bord", icon: "📈" },
};

/** Applique une action de thème (create/rename/delete) — un module n'appartient qu'à un seul onglet thématique à la fois. */
function applyThemeTabAction(themeTabs: ThemeTab[], action: ThemeTabProposalAction): ThemeTab[] {
  if (action.action === "create") {
    const stripped = themeTabs
      .map((t) => ({ ...t, moduleIds: t.moduleIds.filter((id) => !action.moduleIds.includes(id)) }))
      .filter((t) => t.moduleIds.length > 0);
    const newTab: ThemeTab = { id: `theme-${Date.now()}`, label: action.label, moduleIds: action.moduleIds };
    return [...stripped, newTab];
  }
  if (action.action === "rename") {
    return themeTabs.map((t) => (t.id === action.tabId ? { ...t, label: action.label } : t));
  }
  return themeTabs.filter((t) => t.id !== action.tabId);
}

type ActiveTab = number | "map";

/** Heure réelle du message (HH:MM) — utilisée par les rapports et l'audit. */
function nowTime(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export type GeoStatus = "idle" | "pending" | "granted" | "denied";

// Placeholder utilisé le temps qu'un gent tout juste publié (stocké côté client
// dans localStorage) soit chargé — évite un crash pendant le rendu serveur ou
// la première peinture cliente, qui n'ont pas accès à localStorage.
const FALLBACK_ESPACE: Espace = {
  icon: "✨",
  name: "Gent",
  gent: "Gent",
  version: 1,
  status: "live",
  statusLabel: "Actif",
  sensitive: false,
  metrics: [],
  integrations: [],
  tools: [],
  tabs: [],
  map: null,
  memory: "",
  conversations: [],
  activeConversationId: "",
  files: [],
  artefacts: [],
};

function seedEspaces(initialId: string): EspacesMap {
  const espaces: EspacesMap = JSON.parse(JSON.stringify(INITIAL_ESPACES));
  if (!espaces[initialId]) {
    espaces[initialId] = { ...FALLBACK_ESPACE };
  }
  return espaces;
}

interface EspaceContextValue {
  espaces: EspacesMap;
  currentId: string;
  activeTab: ActiveTab;
  railCollapsed: boolean;
  assistantOpen: boolean;
  asideCollapsed: boolean;
  selectedDay: number | null;
  modalArtefactId: string | null;
  modalResvId: string | null;
  currentEspace: Espace;
  activeConversation: ConversationThread;

  switchEspace: (id: string) => void;
  switchTab: (tab: ActiveTab) => void;
  toggleRail: () => void;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAsideCollapsed: () => void;
  selectDay: (day: number | null) => void;
  openArtefactModal: (id: string) => void;
  openResvModal: (id: string) => void;
  closeModal: () => void;
  updateMemory: (text: string) => void;
  sendMessage: (text: string) => void;
  /** Envoie une demande composée à partir d'un formulaire jump (voir jumpFormSignal). */
  submitJumpForm: (values: Record<string, string>) => void;
  isThinking: boolean;
  /** Libellé de la phase en cours (réflexion, outil, rédaction…). */
  thinkingStatus: string | null;
  /** Interrompt la génération en cours (bouton Stop du composer). */
  stopGeneration: () => void;
  /** Position partagée par l'utilisateur (consentement explicite) — null sinon. */
  userPosition: { lat: number; lon: number } | null;
  geoStatus: GeoStatus;
  requestGeolocation: () => void;
  /** Réponse de l'utilisateur à une demande de position émise par le gent dans le fil. */
  confirmGeoRequest: (messageId: string, decision: "share" | "deny") => void;
  removeArtefact: (artefactId: string) => void;
  /** Ouvre l'artefact pointé par un message ; s'il a été retiré de l'espace entre-temps, le recrée depuis la proposition d'origine (toujours conservée dans le message) avant de l'ouvrir. */
  viewArtefact: (messageId: string) => void;
  /** Artefact figé « mini-app » : rafraîchit ses données côté serveur. */
  refreshPinnedArtefact: () => Promise<void>;
  /**
   * Remet la mini-app à zéro : efface le tableau de bord et les valeurs des
   * entrées pour repartir d'un chargement neuf (bouton « New »).
   */
  resetPinnedArtefact: () => void;
  /** Met à jour une entrée de l'artefact figé (LinkedIn, CV…). */
  updatePinnedInput: (inputId: string, value: string) => void;
  pinnedRefreshing: boolean;
  pinnedError: string | null;
  confirmArtefactProposal: (proposalId: string, decision: "add" | "dismiss") => void;
  confirmThemeProposal: (proposalId: string, decision: "apply" | "dismiss") => void;
  /** Valide ou ignore le profil utilisateur proposé par le gent. */
  confirmProfileProposal: (proposalId: string, decision: "apply" | "dismiss") => void;
  toggleChecklistItem: (artefactId: string, itemIndex: number) => void;
  startNewConversation: () => void;
  switchConversation: (id: string) => void;
  confirmReservation: (itemId: string) => void;
  cancelReservation: (itemId: string) => void;
  connectTool: (toolName: string) => void;
  addSpend: (categoryLabel: string, amount: number) => void;
  getResvItem: (id: string) => ReservationItem | undefined;
  /** Vrai quand l'espace est consulté via un lien de partage (destinataire externe). */
  shareMode: boolean;
  /**
   * Mode « mini-application » : l'artefact figé est actif, le gent s'utilise
   * alors par son tableau de bord et non par la conversation.
   */
  miniAppMode: boolean;
  /** Ajoute un document à la session (texte déjà extrait côté navigateur). */
  addFile: (file: UserFile) => void;
  removeFile: (fileId: string) => void;
}

const EspaceContext = createContext<EspaceContextValue | null>(null);

export function EspaceProvider({
  children,
  initialId,
  shareToken,
  initialEspaces,
}: {
  children: ReactNode;
  initialId: string;
  /**
   * Mode « lien de partage » : l'espace est fourni par le serveur (projection
   * publique), le localStorage et la synchro Supabase sont désactivés, et les
   * appels chat/refresh passent par les routes tokenisées.
   */
  shareToken?: string;
  initialEspaces?: EspacesMap;
}) {
  const shareMode = !!shareToken;
  const [espaces, setEspaces] = useState<EspacesMap>(() => initialEspaces ?? seedEspaces(initialId));
  const [currentId, setCurrentId] = useState(initialId);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(0);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [asideCollapsed, setAsideCollapsed] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modalArtefactId, setModalArtefactId] = useState<string | null>(null);
  const [modalResvId, setModalResvId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [pinnedRefreshing, setPinnedRefreshing] = useState(false);
  const [pinnedError, setPinnedError] = useState<string | null>(null);
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;
  const userPositionRef = useRef(userPosition);
  userPositionRef.current = userPosition;
  // Miroir de l'état pour les lectures synchrones hors cycle React (envoi
  // déclenché depuis un callback navigateur, ex. géolocalisation) : les
  // updaters setEspaces ne sont pas garantis d'être exécutés immédiatement.
  const espacesRef = useRef(espaces);
  espacesRef.current = espaces;
  const streamAbortRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  // Géolocalisation à consentement explicite : déclenchée uniquement par un
  // clic utilisateur, puis validée une seconde fois par la permission navigateur.
  const requestGeolocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  // Recharge les gents publiés : d'abord le cache localStorage (instantané,
  // évite le placeholder FALLBACK_ESPACE le temps du réseau), puis Supabase
  // (source de vérité) qui écrase le cache si disponible. On retarde la
  // persistance tant que cette hydratation n'est pas faite, sinon on écrase
  // un gent publié par le placeholder vide au premier rendu.
  useEffect(() => {
    // Lien de partage : le destinataire n'a ni cache local ni accès aux routes
    // /api/gents — l'espace reçu du serveur est la seule source.
    if (shareMode) {
      setStorageReady(true);
      return;
    }
    const published = readPublishedGents();
    if (Object.keys(published).length) {
      setEspaces((prev) => ({ ...prev, ...published }));
    }
    let cancelled = false;
    syncPublishedGentsFromRemote()
      .then((merged) => {
        if (cancelled) return;
        if (merged && Object.keys(merged).length) {
          setEspaces((prev) => ({ ...prev, ...merged }));
        }
      })
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shareMode]);

  // Persiste l'activité des gents publiés (conversations, artefacts…) dans
  // localStorage : c'est ce qui alimente l'onglet Audit côté builder.
  // Important : seulement APRÈS avoir chargé les données depuis localStorage
  // (sinon on écrase les gents tout juste publiés avec le FALLBACK_ESPACE).
  useEffect(() => {
    if (!storageReady || shareMode) return;
    const espace = espaces[currentId];
    if (!espace) return;
    if (readPublishedGents()[currentId]) {
      writePublishedGent(currentId, espace);
    }
  }, [espaces, currentId, storageReady, shareMode]);

  const currentEspace = espaces[currentId];
  const activeConversation = getActiveConversation(
    currentEspace.conversations,
    currentEspace.activeConversationId
  );

  const switchEspace = useCallback((id: string) => {
    setCurrentId(id);
    setActiveTab(0);
    setSelectedDay(null);
    setAsideCollapsed(true);
    const published = readPublishedGents()[id];
    if (published) {
      setEspaces((prev) => ({ ...prev, [id]: published }));
    }
  }, []);

  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedDay(null);
  }, []);

  const toggleRail = useCallback(() => setRailCollapsed((v) => !v), []);

  const openAssistant = useCallback(() => {
    // Mode mini-application : le gent s'utilise par son tableau de bord, la
    // conversation n'est pas proposée. Garde défensive, en plus du masquage
    // des déclencheurs, pour qu'aucun chemin résiduel ne l'ouvre.
    if (espacesRef.current[currentIdRef.current]?.pinnedArtefact?.enabled) return;
    setAssistantOpen(true);
    // Libère de la place : rail et aside se réduisent ; l'utilisateur peut les rouvrir.
    setRailCollapsed(true);
    setAsideCollapsed(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
  }, []);

  const toggleAsideCollapsed = useCallback(() => setAsideCollapsed((v) => !v), []);

  const selectDay = useCallback((day: number | null) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  }, []);

  const openArtefactModal = useCallback((id: string) => {
    setModalArtefactId(id);
    setModalResvId(null);
  }, []);

  const openResvModal = useCallback((id: string) => {
    setModalResvId(id);
    setModalArtefactId(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalArtefactId(null);
    setModalResvId(null);
  }, []);

  const updateMemory = useCallback((text: string) => {
    setEspaces((prev) => {
      const next = { ...prev, [currentId]: { ...prev[currentId], memory: text } };
      return next;
    });
  }, [currentId]);

  // Documents de la session : le texte est extrait côté navigateur avant
  // l'appel, et alimente ensuite les deux modes (conversation et artefact figé).
  const addFile = useCallback((file: UserFile) => {
    setEspaces((prev) => {
      const e = prev[currentId];
      return { ...prev, [currentId]: { ...e, files: [file, ...e.files.filter((f) => f.id !== file.id)] } };
    });
  }, [currentId]);

  const removeFile = useCallback((fileId: string) => {
    setEspaces((prev) => {
      const e = prev[currentId];
      return { ...prev, [currentId]: { ...e, files: e.files.filter((f) => f.id !== fileId) } };
    });
  }, [currentId]);

  const sendMessage = useCallback((text: string) => {
    if (streamAbortRef.current) return; // une génération est déjà en cours
    const id = currentIdRef.current;
    const userMsg = { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: nowTime() };
    const agentPlaceholder = { role: "agent" as const, text: "", t: nowTime() };

    // Capture synchrone depuis le miroir espacesRef : sendMessage peut être
    // appelé hors d'un événement React (callback de géolocalisation), où les
    // updaters setEspaces ne s'exécutent pas immédiatement.
    const espace = espacesRef.current[id];
    const position = userPositionRef.current;
    const threadId = espace.activeConversationId;
    const mcpServers = espace.mcpServers;
    const datasets = espace.datasets;
    const prim = espace.prim;
    const powens = espace.powens;
    const restApis = espace.restApis;
    const webSearch = espace.webSearch;
    const thread = espace.conversations.find((t) => t.id === threadId);
    const history = [...(thread?.messages ?? []), userMsg]
      .filter((m) => m.role === "agent" || m.role === "user")
      .map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: (m.text ?? "").replace(/<[^>]+>/g, ""),
      }));

    const basePrompt =
      espace.systemPrompt?.trim() || `Tu es l'assistant IA de Getgents pour l'espace "${espace.name}".`;
    // Mémoire + documents téléversés : même contexte que celui fourni à
    // l'artefact figé, pour que les deux modes voient la même chose.
    const memoryNote = sessionContextNote(espace);
    // Le modèle n'a pas d'horloge : sans cette note, il invente l'heure
    // courante (ex. « dans 2 min (14:35) » alors qu'il est 11h01).
    const timeNote = `\n\nDate et heure actuelles : ${new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "full",
      timeStyle: "short",
    })} (heure de Paris). Utilise exclusivement cette horloge pour toute heure, durée d'attente ou délai que tu annonces.`;
    // Garde-fou anti-hallucination : sans source réelle, interdiction de
    // présenter des données comme du temps réel.
    const hasRealSource =
      !!espace.datasets?.length ||
      !!espace.mcpServers?.length ||
      !!espace.webSearch ||
      !!espace.prim ||
      !!espace.powens ||
      !!espace.restApis?.length;
    const honestyNote = hasRealSource
      ? ""
      : "\n\nIMPORTANT : tu n'as accès à AUCUNE source de données temps réel (aucun connecteur actif, recherche web désactivée). Ne présente jamais d'horaires, de prix, de disponibilités ou de passages comme des données réelles ou « en temps réel » — tu ne peux pas les connaître. Dis-le clairement à l'utilisateur, donne au mieux des indications générales explicitement marquées comme non vérifiées, et suggère au créateur du gent de connecter une source de données réelle.";
    const positionNote = position
      ? `\n\nPosition de l'utilisateur (partagée avec son consentement) : latitude ${position.lat}, longitude ${position.lon}.`
      : "";
    const geolocNote = espace.prim ? `\n\n${GEOLOC_PROMPT_INSTRUCTION}` : "";
    const profileNote = espace.profile ? `\n\n${profileContextNote(espace.profile)}` : "";
    const systemPrompt =
      `${basePrompt}${timeNote}${honestyNote}${memoryNote}${positionNote}${geolocNote}${profileNote}\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}\n\n${ARTEFACT_PROMPT_INSTRUCTION}` +
      `\n\n${THEME_TAB_PROMPT_INSTRUCTION}\n\n${describeModulesForPrompt(espace)}\n\n${PROFILE_PROMPT_INSTRUCTION}`;
    const chatModelId = espace.chatModelId ?? "anthropic/claude-sonnet-5";

    setEspaces((prev) => {
      const e = prev[id];
      const conversations = e.conversations.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, userMsg, agentPlaceholder] } : t
      );
      return { ...prev, [id]: { ...e, conversations } };
    });

    setIsThinking(true);
    setThinkingStatus(defaultStatusLabel("preparing"));

    const controller = new AbortController();
    streamAbortRef.current = controller;

    function updateLastMessage(updater: (m: ConversationMessage) => ConversationMessage) {
      setEspaces((p) => {
        const e = p[id];
        const convs = e.conversations.map((t) => {
          if (t.id !== threadId) return t;
          const msgs = [...t.messages];
          const lastIdx = msgs.length - 1;
          if (lastIdx < 0) return t;
          msgs[lastIdx] = updater(msgs[lastIdx]);
          return { ...t, messages: msgs };
        });
        return { ...p, [id]: { ...e, conversations: convs } };
      });
    }

    // Insère un message "outil" juste avant la bulle agent en cours de frappe,
    // pour montrer en direct les appels MCP effectués par le gent.
    function pushToolMessage(kind: string, what: string, ok: boolean, toolDetail?: string) {
      setEspaces((p) => {
        const e = p[id];
        const convs = e.conversations.map((t) => {
          if (t.id !== threadId) return t;
          const msgs = [...t.messages];
          msgs.splice(Math.max(msgs.length - 1, 0), 0, {
            role: "tool" as const,
            kind,
            what,
            ok,
            toolDetail,
            t: nowTime(),
          });
          return { ...t, messages: msgs };
        });
        return { ...p, [id]: { ...e, conversations: convs } };
      });
    }

    streamChatCompletion(
      {
        model: chatModelId,
        messages: [{ role: "system", content: systemPrompt }, ...history],
        max_tokens: CHAT_MAX_TOKENS.espace,
        reasoning: { enabled: true },
        mcpServers,
        datasets,
        prim,
        powens,
        restApis,
        webSearch,
      },
      (fullSoFar, reasoningSoFar) => {
        const displayRaw = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(displayRaw), reasoning: reasoningSoFar || undefined }));
      },
      (ev) => {
        if (ev.status === "running" && ev.call) {
          setThinkingStatus(defaultStatusLabel("tool_running", humanToolCallLabel(ev.call)));
        } else if (ev.status === "done") {
          setThinkingStatus(defaultStatusLabel("thinking"));
          const call = ev.call ?? "";
          // Étiquette selon la nature réelle de la source (le transport n'est
          // pas toujours MCP : PRIM et datasets sont des outils intégrés).
          const kind = call.startsWith("prim_")
            ? "PRIM"
            : call.startsWith("powens_")
              ? "Powens"
              : call.startsWith("dataset_")
                ? "Dataset"
                : call.startsWith("rest_")
                  ? "API REST"
                  : "MCP";
          const [server, tool] = call.split("__");
          pushToolMessage(kind, tool ? `${server} · ${tool}` : call, ev.ok !== false, ev.detail);
        } else if (ev.status === "connect_error") {
          pushToolMessage("MCP", `Connexion impossible à ${ev.server} — ${ev.message ?? "erreur"}`, false);
        }
      },
      (status) => setThinkingStatus(status.label),
      shareToken ? `/api/links/${encodeURIComponent(shareToken)}/chat` : undefined,
      controller.signal
    )
      .then(({ text: fullRaw, reasoning, truncated }) => {
        const afterQuestions = extractQuestions(fullRaw);
        const afterArtefact = extractArtefactSignal(afterQuestions.text);
        const afterTheme = extractThemeTabSignal(afterArtefact.text);
        const afterGeo = extractGeolocRequest(afterTheme.text);
        const afterProfile = extractProfileSignal(afterGeo.text);
        const finalHtml =
          renderMarkdown(afterProfile.text) +
          (truncated
            ? '<p>⚠️ <em>Réponse tronquée (limite de longueur atteinte) — écrivez « continue » pour obtenir la suite, ou demandez une version plus courte.</em></p>'
            : "");

        // Profil proposé par le gent (onboarding, CV joint) : carte de
        // validation dans le fil — jamais appliqué sans accord explicite.
        function pushProfileProposalIfAny() {
          if (!afterProfile.profile) return;
          const profMsgId = `profile-${Date.now()}`;
          setEspaces((p) => {
            const e = p[id];
            const convs = e.conversations.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    messages: [
                      ...t.messages,
                      {
                        id: profMsgId,
                        role: "profile-proposal" as const,
                        profileProposal: afterProfile.profile!,
                        profileProposalStatus: "pending" as const,
                        t: nowTime(),
                      },
                    ],
                  }
                : t
            );
            return { ...p, [id]: { ...e, conversations: convs } };
          });
        }

        // Demande de position émise par le gent : carte de consentement dans
        // le fil (jamais de géolocalisation sans validation explicite).
        function pushGeoRequestIfAny() {
          if (!afterGeo.geoRequest || userPositionRef.current) return;
          const geoMsgId = `geo-${Date.now()}`;
          setEspaces((p) => {
            const e = p[id];
            const convs = e.conversations.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    messages: [
                      ...t.messages,
                      { id: geoMsgId, role: "geo-request" as const, geoRequestStatus: "pending" as const, t: nowTime() },
                    ],
                  }
                : t
            );
            return { ...p, [id]: { ...e, conversations: convs } };
          });
        }

        if (afterArtefact.artefact) {
          const sig = afterArtefact.artefact;
          const proposalId = `prop-${Date.now()}`;
          setEspaces((p) => {
            const e = p[id];
            const convs = e.conversations.map((t) => {
              if (t.id !== threadId) return t;
              const msgs = [...t.messages];
              const lastIdx = msgs.length - 1;
              if (lastIdx >= 0)
                msgs[lastIdx] = {
                  ...msgs[lastIdx],
                  text: finalHtml,
                  questions: afterQuestions.questions,
                  reasoning: reasoning || undefined,
                };
              msgs.push({
                id: proposalId,
                role: "artef-proposal" as const,
                proposal: sig,
                proposalStatus: "pending" as const,
                t: nowTime(),
              });
              return { ...t, messages: msgs };
            });
            return { ...p, [id]: { ...e, conversations: convs } };
          });
        } else if (afterTheme.themeAction) {
          const action = afterTheme.themeAction;
          const proposalId = `theme-prop-${Date.now()}`;
          setEspaces((p) => {
            const e = p[id];
            const convs = e.conversations.map((t) => {
              if (t.id !== threadId) return t;
              const msgs = [...t.messages];
              const lastIdx = msgs.length - 1;
              if (lastIdx >= 0)
                msgs[lastIdx] = {
                  ...msgs[lastIdx],
                  text: finalHtml,
                  questions: afterQuestions.questions,
                  reasoning: reasoning || undefined,
                };
              msgs.push({
                id: proposalId,
                role: "theme-proposal" as const,
                themeProposal: action,
                themeProposalStatus: "pending" as const,
                t: nowTime(),
              });
              return { ...t, messages: msgs };
            });
            return { ...p, [id]: { ...e, conversations: convs } };
          });
        } else {
          updateLastMessage((m) => ({
            ...m,
            text: finalHtml,
            questions: afterQuestions.questions,
            reasoning: reasoning || undefined,
          }));
        }
        pushGeoRequestIfAny();
        pushProfileProposalIfAny();
      })
      .catch((err: Error) => {
        if (err?.name === "AbortError") {
          updateLastMessage((m) => ({
            ...m,
            text: (m.text?.trim()
              ? m.text
              : "") + '<p><em>Génération interrompue.</em></p>',
          }));
          return;
        }
        updateLastMessage(() => ({
          role: "agent" as const,
          text: `<p>Erreur de connexion au service IA${err?.message ? ` : ${err.message}` : ""}.</p>`,
          t: nowTime(),
        }));
      })
      .finally(() => {
        if (streamAbortRef.current === controller) streamAbortRef.current = null;
        setIsThinking(false);
        setThinkingStatus(null);
      });
  }, [shareToken]);

  // Compose une demande à partir d'un formulaire jump puis l'envoie au gent.
  const submitJumpForm = useCallback(
    (values: Record<string, string>) => {
      const espace = espacesRef.current[currentIdRef.current];
      const form = espace?.jumpForm;
      if (!form) return;
      const prompt = buildJumpFormPrompt(form, values);
      if (prompt.trim()) sendMessage(prompt);
    },
    [sendMessage]
  );

  // Met à jour le statut d'une carte de demande de position dans le fil.
  const setGeoRequestStatus = useCallback((messageId: string, status: NonNullable<ConversationMessage["geoRequestStatus"]>) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      const conversations = espace.conversations.map((t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === messageId ? { ...m, geoRequestStatus: status } : m)),
      }));
      return { ...prev, [id]: { ...espace, conversations } };
    });
  }, []);

  const confirmGeoRequest = useCallback(
    (messageId: string, decision: "share" | "deny") => {
      if (decision === "deny") {
        setGeoRequestStatus(messageId, "denied");
        sendMessage("Je préfère ne pas partager ma position.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGeoRequestStatus(messageId, "error");
        return;
      }
      setGeoStatus("pending");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          // Mise à jour immédiate du ref : le sendMessage ci-dessous doit
          // injecter la position sans attendre le prochain rendu.
          userPositionRef.current = position;
          setUserPosition(position);
          setGeoStatus("granted");
          setGeoRequestStatus(messageId, "granted");
          sendMessage("J'ai partagé ma position — tu peux chercher autour de moi.");
        },
        () => {
          setGeoStatus("denied");
          setGeoRequestStatus(messageId, "error");
        },
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    },
    [sendMessage, setGeoRequestStatus]
  );

  // Retire un artefact de l'espace (canvas + onglets thématiques) ; la
  // proposition d'origine reste visible dans le fil, marquée comme retirée.
  const removeArtefact = useCallback((artefactId: string) => {
    const id = currentIdRef.current;
    setModalArtefactId((prev) => (prev === artefactId ? null : prev));
    setEspaces((prev) => {
      const espace = prev[id];
      const artefacts = espace.artefacts.filter((a) => a.id !== artefactId);
      const themeTabs = (espace.themeTabs ?? [])
        .map((t) => ({ ...t, moduleIds: t.moduleIds.filter((mid) => mid !== `artef-${artefactId}`) }))
        .filter((t) => t.moduleIds.length > 0);
      return { ...prev, [id]: { ...espace, artefacts, themeTabs } };
    });
  }, []);

  const viewArtefact = useCallback(
    (messageId: string) => {
      const id = currentIdRef.current;
      const espace = espacesRef.current[id];
      if (!espace) return;

      let targetMsg: ConversationMessage | undefined;
      let targetThreadId: string | undefined;
      for (const t of espace.conversations) {
        const found = t.messages.find((m) => m.id === messageId);
        if (found) {
          targetMsg = found;
          targetThreadId = t.id;
          break;
        }
      }
      if (!targetMsg?.proposal) return;

      const stillPresent = !!targetMsg.ref && espace.artefacts.some((a) => a.id === targetMsg!.ref);
      if (stillPresent) {
        openArtefactModal(targetMsg.ref!);
        return;
      }

      // L'artefact a été retiré de l'espace entre-temps : la proposition
      // d'origine reste dans le message, on la recrée à l'identique.
      const sig = targetMsg.proposal;
      const meta = ARTEFACT_KIND_META[sig.kind] ?? { type: "Artefact", icon: "📄" };
      const newArtefactId = `artef-${Date.now()}`;
      const newArtefact: Artefact = {
        id: newArtefactId,
        title: sig.title,
        type: meta.type,
        icon: meta.icon,
        date: "à l'instant",
        body: sig.body ? renderMarkdown(sig.body) : undefined,
        chartData: sig.chartData,
        checklistItems: sig.items?.map((label) => ({ label, checked: false })),
        mapPoints: sig.mapPoints,
        dashboard: sig.dashboard,
      };

      setEspaces((prev) => {
        const cur = prev[id];
        const artefacts = [newArtefact, ...cur.artefacts];
        const conversations = cur.conversations.map((t) =>
          t.id === targetThreadId
            ? { ...t, messages: t.messages.map((m) => (m.id === messageId ? { ...m, ref: newArtefactId } : m)) }
            : t
        );
        return { ...prev, [id]: { ...cur, artefacts, conversations } };
      });
      openArtefactModal(newArtefactId);
    },
    [openArtefactModal]
  );

  // Met à jour une entrée de l'artefact figé (LinkedIn, CV…) localement.
  const updatePinnedInput = useCallback((inputId: string, value: string) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      if (!espace?.pinnedArtefact) return prev;
      const inputs = espace.pinnedArtefact.inputs.map((i) => (i.id === inputId ? { ...i, value } : i));
      return { ...prev, [id]: { ...espace, pinnedArtefact: { ...espace.pinnedArtefact, inputs } } };
    });
  }, []);

  const resetPinnedArtefact = useCallback(() => {
    const id = currentIdRef.current;
    setPinnedError(null);
    setEspaces((prev) => {
      const espace = prev[id];
      const pinned = espace?.pinnedArtefact;
      if (!pinned?.enabled) return prev;
      const { dashboard: _d, generatedAt: _g, ...rest } = pinned;
      return {
        ...prev,
        [id]: {
          ...espace,
          pinnedArtefact: {
            ...rest,
            inputs: pinned.inputs.map(({ value: _v, ...input }) => input),
          },
        },
      };
    });
  }, []);

  // Rafraîchit l'artefact figé côté serveur (régénère le tableau de bord à
  // partir de la mission + des entrées). Le résultat remplace le dashboard en
  // place, sans que l'utilisateur ait à reformuler quoi que ce soit.
  const refreshPinnedArtefact = useCallback(async () => {
    const id = currentIdRef.current;
    const espace = espacesRef.current[id];
    if (!espace?.pinnedArtefact?.enabled) return;
    setPinnedRefreshing(true);
    setPinnedError(null);
    try {
      const inputs = Object.fromEntries(espace.pinnedArtefact.inputs.map((i) => [i.id, i.value ?? ""]));
      const slim = espaceForPinnedRefresh(espace, inputs);
      // Lien de partage : le destinataire n'a ni la mission ni le prompt
      // système — le serveur les relit en base à partir du token, et n'accepte
      // que les valeurs d'entrées.
      const res = shareToken
        ? await fetch(`/api/links/${encodeURIComponent(shareToken)}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inputs }),
          })
        : await fetch("/api/artefact/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ espace: slim }),
          });
      // Vercel peut renvoyer une page HTML (504) au lieu de JSON quand la
      // fonction est tuée : on lit d'abord le texte pour un message clair.
      const rawBody = await res.text();
      let data: {
        ok?: boolean;
        note?: string;
        dashboard?: NonNullable<Espace["pinnedArtefact"]>["dashboard"];
        run?: PinnedRun | null;
        error?: string;
        hint?: string;
      } = {};
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        setPinnedError(
          res.status >= 500
            ? `Le serveur a interrompu la génération (HTTP ${res.status}). Réessayez ; avec la recherche web, comptez 1 à 2 minutes.`
            : `Réponse serveur illisible (HTTP ${res.status}).`
        );
        return;
      }

      // L'historique enregistre aussi les échecs : c'est ce qui rend l'onglet
      // Audit utile quand une génération ne passe pas.
      const archive = (base: NonNullable<Espace["pinnedArtefact"]>, patch: Partial<NonNullable<Espace["pinnedArtefact"]>>) => {
        const runs = data.run ? [data.run, ...(base.runs ?? [])].slice(0, 20) : base.runs;
        setEspaces((prev) => ({ ...prev, [id]: { ...prev[id], pinnedArtefact: { ...base, ...patch, runs } } }));
      };

      if (!res.ok || data.error) {
        setPinnedError(`Échec : ${data.error ?? data.note ?? res.status}${data.hint ? ` — ${data.hint}` : ""}`);
        if (espace.pinnedArtefact) archive(espace.pinnedArtefact, {});
        return;
      }
      if (!data.ok) setPinnedError(data.note ?? "La génération n'a pas abouti.");
      if (espace.pinnedArtefact) {
        archive(
          espace.pinnedArtefact,
          data.dashboard
            ? {
                inputs: slim.pinnedArtefact!.inputs,
                dashboard: data.dashboard,
                generatedAt: new Date().toISOString(),
              }
            : { inputs: slim.pinnedArtefact!.inputs }
        );
      }
    } catch (e) {
      setPinnedError(formatApiNetworkError(e));
    } finally {
      setPinnedRefreshing(false);
    }
  }, [shareToken]);

  const confirmArtefactProposal = useCallback((proposalId: string, decision: "add" | "dismiss") => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      let targetMsg: ConversationMessage | undefined;
      let targetThreadId: string | undefined;
      for (const t of espace.conversations) {
        const found = t.messages.find((m) => m.id === proposalId);
        if (found) {
          targetMsg = found;
          targetThreadId = t.id;
          break;
        }
      }
      if (!targetMsg?.proposal) return prev;

      let artefacts = espace.artefacts;
      let newArtefactId: string | undefined;
      if (decision === "add") {
        const sig = targetMsg.proposal;
        const meta = ARTEFACT_KIND_META[sig.kind] ?? { type: "Artefact", icon: "📄" };
        newArtefactId = `artef-${Date.now()}`;
        const newArtefact: Artefact = {
          id: newArtefactId,
          title: sig.title,
          type: meta.type,
          icon: meta.icon,
          date: "à l'instant",
          body: sig.body ? renderMarkdown(sig.body) : undefined,
          chartData: sig.chartData,
          checklistItems: sig.items?.map((label) => ({ label, checked: false })),
          mapPoints: sig.mapPoints,
          dashboard: sig.dashboard,
        };
        artefacts = [newArtefact, ...espace.artefacts];
      }

      const conversations = espace.conversations.map((t) =>
        t.id === targetThreadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === proposalId
                  ? {
                      ...m,
                      proposalStatus: decision === "add" ? ("added" as const) : ("dismissed" as const),
                      ref: newArtefactId,
                    }
                  : m
              ),
            }
          : t
      );

      return { ...prev, [id]: { ...espace, artefacts, conversations } };
    });
  }, []);

  const confirmThemeProposal = useCallback((proposalId: string, decision: "apply" | "dismiss") => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      let targetMsg: ConversationMessage | undefined;
      let targetThreadId: string | undefined;
      for (const t of espace.conversations) {
        const found = t.messages.find((m) => m.id === proposalId);
        if (found) {
          targetMsg = found;
          targetThreadId = t.id;
          break;
        }
      }
      if (!targetMsg?.themeProposal) return prev;

      const themeTabs =
        decision === "apply"
          ? applyThemeTabAction(espace.themeTabs ?? [], targetMsg.themeProposal)
          : espace.themeTabs ?? [];

      const conversations = espace.conversations.map((t) =>
        t.id === targetThreadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === proposalId
                  ? {
                      ...m,
                      themeProposalStatus: decision === "apply" ? ("applied" as const) : ("dismissed" as const),
                    }
                  : m
              ),
            }
          : t
      );

      return { ...prev, [id]: { ...espace, themeTabs, conversations } };
    });
  }, []);

  // Valide ou ignore un profil proposé par le gent. Une fois appliqué, le
  // profil vit sur l'espace : il est persisté avec lui (Supabase) et réinjecté
  // dans le prompt système de chaque échange suivant.
  const confirmProfileProposal = useCallback((proposalId: string, decision: "apply" | "dismiss") => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      let targetMsg: ConversationMessage | undefined;
      let targetThreadId: string | undefined;
      for (const t of espace.conversations) {
        const found = t.messages.find((m) => m.id === proposalId);
        if (found) {
          targetMsg = found;
          targetThreadId = t.id;
          break;
        }
      }
      if (!targetMsg?.profileProposal) return prev;

      const profile = decision === "apply" ? targetMsg.profileProposal : espace.profile;

      const conversations = espace.conversations.map((t) =>
        t.id === targetThreadId
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === proposalId
                  ? {
                      ...m,
                      profileProposalStatus: decision === "apply" ? ("applied" as const) : ("dismissed" as const),
                    }
                  : m
              ),
            }
          : t
      );

      return { ...prev, [id]: { ...espace, profile, conversations } };
    });
  }, []);

  const toggleChecklistItem = useCallback((artefactId: string, itemIndex: number) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      const artefacts = espace.artefacts.map((a) => {
        if (a.id !== artefactId || !a.checklistItems) return a;
        const checklistItems = a.checklistItems.map((it, i) =>
          i === itemIndex ? { ...it, checked: !it.checked } : it
        );
        return { ...a, checklistItems };
      });
      return { ...prev, [id]: { ...espace, artefacts } };
    });
  }, []);

  const startNewConversation = useCallback(() => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      const active = getActiveConversation(espace.conversations, espace.activeConversationId);
      if (active.messages.length === 0) return prev;

      const id = newConversationId();
      const thread: ConversationThread = {
        id,
        startedAt: formatConversationStartedAt(),
        messages: [],
      };
      return {
        ...prev,
        [currentId]: {
          ...espace,
          conversations: [thread, ...espace.conversations],
          activeConversationId: id,
        },
      };
    });
  }, [currentId]);

  const switchConversation = useCallback((id: string) => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      if (!espace.conversations.some((t) => t.id === id)) return prev;
      return { ...prev, [currentId]: { ...espace, activeConversationId: id } };
    });
  }, [currentId]);

  const getResvItem = useCallback((id: string): ReservationItem | undefined => {
    const tab = espaces[currentId].tabs.find((t) => t.kind === "resv");
    return tab?.items?.find((x) => x.id === id);
  }, [espaces, currentId]);

  const isToolConnected = useCallback((serviceName: string): boolean => {
    const tool = espaces[currentId].tools.find((t) => t.name === serviceName);
    return tool?.connected ?? false;
  }, [espaces, currentId]);

  const confirmReservation = useCallback((itemId: string) => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      const tabs = espace.tabs.map((tab) => {
        if (tab.kind !== "resv" || !tab.items) return tab;
        const items = tab.items.map((item) => {
          if (item.id !== itemId) return item;
          if (item.category === "compte_tiers") {
            const tool = espace.tools.find((t) => t.name === item.service);
            if (!tool?.connected) return item; // invariant: jamais de envoi sans compte connecté
            return { ...item, status: "sent" as const };
          }
          return { ...item, status: "confirmed" as const };
        });
        return { ...tab, items };
      });
      return { ...prev, [currentId]: { ...espace, tabs } };
    });
  }, [currentId]);

  const cancelReservation = useCallback((itemId: string) => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      const tabs = espace.tabs.map((tab) => {
        if (tab.kind !== "resv" || !tab.items) return tab;
        const items = tab.items.map((item) =>
          item.id === itemId ? { ...item, status: "cancelled" as const } : item
        );
        return { ...tab, items };
      });
      return { ...prev, [currentId]: { ...espace, tabs } };
    });
  }, [currentId]);

  const connectTool = useCallback((toolName: string) => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      const tools = espace.tools.map((t) =>
        t.name === toolName ? { ...t, connected: true } : t
      );
      return { ...prev, [currentId]: { ...espace, tools } };
    });
  }, [currentId]);

  const addSpend = useCallback((categoryLabel: string, amount: number) => {
    setEspaces((prev) => {
      const espace = prev[currentId];
      const tabs = espace.tabs.map((tab) => {
        if (tab.kind !== "chart" || !tab.categories || !tab.history) return tab;
        const categories = tab.categories.map((c) =>
          c.label === categoryLabel ? { ...c, spent: c.spent + amount } : c
        );
        const lastCum = tab.history[tab.history.length - 1]?.cum ?? 0;
        const history = [...tab.history, { day: "Ajout", cum: lastCum + amount }];
        return { ...tab, categories, history };
      });
      return { ...prev, [currentId]: { ...espace, tabs } };
    });
  }, [currentId]);

  void isToolConnected;

  return (
    <EspaceContext.Provider
      value={{
        espaces,
        currentId,
        activeTab,
        railCollapsed,
        assistantOpen,
        asideCollapsed,
        selectedDay,
        modalArtefactId,
        modalResvId,
        currentEspace,
        activeConversation,
        switchEspace,
        switchTab,
        toggleRail,
        openAssistant,
        closeAssistant,
        toggleAsideCollapsed,
        selectDay,
        openArtefactModal,
        openResvModal,
        closeModal,
        updateMemory,
        sendMessage,
        submitJumpForm,
        isThinking,
        thinkingStatus,
        stopGeneration,
        userPosition,
        geoStatus,
        requestGeolocation,
        confirmGeoRequest,
        removeArtefact,
        viewArtefact,
        refreshPinnedArtefact,
        resetPinnedArtefact,
        updatePinnedInput,
        pinnedRefreshing,
        pinnedError,
        shareMode,
        miniAppMode: !!currentEspace.pinnedArtefact?.enabled,
        addFile,
        removeFile,
        confirmArtefactProposal,
        confirmThemeProposal,
        confirmProfileProposal,
        toggleChecklistItem,
        startNewConversation,
        switchConversation,
        confirmReservation,
        cancelReservation,
        connectTool,
        addSpend,
        getResvItem,
      }}
    >
      {children}
    </EspaceContext.Provider>
  );
}

export function useEspace(): EspaceContextValue {
  const ctx = useContext(EspaceContext);
  if (!ctx) throw new Error("useEspace must be used within EspaceProvider");
  return ctx;
}
