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
} from "@/lib/types";
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
import { readPublishedGents, writePublishedGent } from "@/lib/publishedGents";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion, CHAT_MAX_TOKENS } from "@/lib/streamChat";

const ARTEFACT_KIND_META: Record<string, { type: string; icon: string }> = {
  report: { type: "Rapport", icon: "📄" },
  checklist: { type: "Checklist", icon: "✅" },
  chart: { type: "Graphique", icon: "📊" },
  visual: { type: "Aperçu visuel", icon: "🖼️" },
  map: { type: "Carte", icon: "🗺️" },
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
  isThinking: boolean;
  /** Position partagée par l'utilisateur (consentement explicite) — null sinon. */
  userPosition: { lat: number; lon: number } | null;
  geoStatus: GeoStatus;
  requestGeolocation: () => void;
  /** Réponse de l'utilisateur à une demande de position émise par le gent dans le fil. */
  confirmGeoRequest: (messageId: string, decision: "share" | "deny") => void;
  removeArtefact: (artefactId: string) => void;
  confirmArtefactProposal: (proposalId: string, decision: "add" | "dismiss") => void;
  confirmThemeProposal: (proposalId: string, decision: "apply" | "dismiss") => void;
  toggleChecklistItem: (artefactId: string, itemIndex: number) => void;
  startNewConversation: () => void;
  switchConversation: (id: string) => void;
  confirmReservation: (itemId: string) => void;
  cancelReservation: (itemId: string) => void;
  connectTool: (toolName: string) => void;
  addSpend: (categoryLabel: string, amount: number) => void;
  getResvItem: (id: string) => ReservationItem | undefined;
}

const EspaceContext = createContext<EspaceContextValue | null>(null);

export function EspaceProvider({ children, initialId }: { children: ReactNode; initialId: string }) {
  const [espaces, setEspaces] = useState<EspacesMap>(() => seedEspaces(initialId));
  const [currentId, setCurrentId] = useState(initialId);
  const [activeTab, setActiveTab] = useState<ActiveTab>(0);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [asideCollapsed, setAsideCollapsed] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modalArtefactId, setModalArtefactId] = useState<string | null>(null);
  const [modalResvId, setModalResvId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;
  const userPositionRef = useRef(userPosition);
  userPositionRef.current = userPosition;
  // Miroir de l'état pour les lectures synchrones hors cycle React (envoi
  // déclenché depuis un callback navigateur, ex. géolocalisation) : les
  // updaters setEspaces ne sont pas garantis d'être exécutés immédiatement.
  const espacesRef = useRef(espaces);
  espacesRef.current = espaces;

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

  // Recharge les gents publiés depuis ce navigateur (localStorage) — n'existe
  // pas encore côté serveur/premier rendu, d'où le placeholder FALLBACK_ESPACE.
  useEffect(() => {
    const published = readPublishedGents();
    if (Object.keys(published).length) {
      setEspaces((prev) => ({ ...prev, ...published }));
    }
  }, []);

  // Persiste l'activité des gents publiés (conversations, artefacts…) dans
  // localStorage : c'est ce qui alimente l'onglet Audit côté builder.
  useEffect(() => {
    const espace = espaces[currentId];
    if (!espace) return;
    if (readPublishedGents()[currentId]) {
      writePublishedGent(currentId, espace);
    }
  }, [espaces, currentId]);

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

  const sendMessage = useCallback((text: string) => {
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
    const memoryNote = espace.memory ? `\n\nMémoire de l'espace : ${espace.memory}` : "";
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
      !!espace.datasets?.length || !!espace.mcpServers?.length || !!espace.webSearch || !!espace.prim;
    const honestyNote = hasRealSource
      ? ""
      : "\n\nIMPORTANT : tu n'as accès à AUCUNE source de données temps réel (aucun connecteur actif, recherche web désactivée). Ne présente jamais d'horaires, de prix, de disponibilités ou de passages comme des données réelles ou « en temps réel » — tu ne peux pas les connaître. Dis-le clairement à l'utilisateur, donne au mieux des indications générales explicitement marquées comme non vérifiées, et suggère au créateur du gent de connecter une source de données réelle.";
    const positionNote = position
      ? `\n\nPosition de l'utilisateur (partagée avec son consentement) : latitude ${position.lat}, longitude ${position.lon}.`
      : "";
    const geolocNote = espace.datasets?.length || espace.prim ? `\n\n${GEOLOC_PROMPT_INSTRUCTION}` : "";
    const systemPrompt =
      `${basePrompt}${timeNote}${honestyNote}${memoryNote}${positionNote}${geolocNote}\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}\n\n${ARTEFACT_PROMPT_INSTRUCTION}` +
      `\n\n${THEME_TAB_PROMPT_INSTRUCTION}\n\n${describeModulesForPrompt(espace)}`;
    const chatModelId = espace.chatModelId ?? "anthropic/claude-sonnet-5";

    setEspaces((prev) => {
      const e = prev[id];
      const conversations = e.conversations.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, userMsg, agentPlaceholder] } : t
      );
      return { ...prev, [id]: { ...e, conversations } };
    });

    setIsThinking(true);

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
    function pushToolMessage(kind: string, what: string, ok: boolean) {
      setEspaces((p) => {
        const e = p[id];
        const convs = e.conversations.map((t) => {
          if (t.id !== threadId) return t;
          const msgs = [...t.messages];
          msgs.splice(Math.max(msgs.length - 1, 0), 0, { role: "tool" as const, kind, what, ok, t: nowTime() });
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
        webSearch,
      },
      (fullSoFar, reasoningSoFar) => {
        const displayRaw = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(displayRaw), reasoning: reasoningSoFar || undefined }));
      },
      (ev) => {
        if (ev.status === "done") {
          const [server, tool] = (ev.call ?? "").split("__");
          pushToolMessage("MCP", `${server ?? "serveur"} · ${tool ?? ev.call}`, ev.ok !== false);
        } else if (ev.status === "connect_error") {
          pushToolMessage("MCP", `Connexion impossible à ${ev.server} — ${ev.message ?? "erreur"}`, false);
        }
      }
    )
      .then(({ text: fullRaw, reasoning, truncated }) => {
        const afterQuestions = extractQuestions(fullRaw);
        const afterArtefact = extractArtefactSignal(afterQuestions.text);
        const afterTheme = extractThemeTabSignal(afterArtefact.text);
        const afterGeo = extractGeolocRequest(afterTheme.text);
        const truncationSuffix = truncated
          ? "\n\n⚠️ *Réponse interrompue (limite de longueur atteinte). Relancez ou demandez « continue » pour obtenir la suite.*"
          : "";
        const finalHtml = renderMarkdown(afterGeo.text + truncationSuffix);

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
      })
      .catch((err: Error) => {
        updateLastMessage(() => ({
          role: "agent" as const,
          text: `<p>Erreur de connexion au service IA${err?.message ? ` : ${err.message}` : ""}.</p>`,
          t: nowTime(),
        }));
      })
      .finally(() => setIsThinking(false));
  }, []);

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
        isThinking,
        userPosition,
        geoStatus,
        requestGeolocation,
        confirmGeoRequest,
        removeArtefact,
        confirmArtefactProposal,
        confirmThemeProposal,
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
