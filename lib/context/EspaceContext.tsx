"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { Espace, EspacesMap, ReservationItem, ConversationThread, ConversationMessage, Artefact } from "@/lib/types";
import { ESPACES as INITIAL_ESPACES } from "@/lib/mock-data/espaces";
import {
  formatConversationStartedAt,
  getActiveConversation,
  newConversationId,
} from "@/lib/conversationUtils";
import { extractQuestions, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import { extractArtefactSignal, ARTEFACT_PROMPT_INSTRUCTION } from "@/lib/artefactSignal";
import { readPublishedGents } from "@/lib/publishedGents";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion } from "@/lib/streamChat";

const ARTEFACT_KIND_META: Record<string, { type: string; icon: string }> = {
  report: { type: "Rapport", icon: "📄" },
  checklist: { type: "Checklist", icon: "✅" },
  chart: { type: "Graphique", icon: "📊" },
  visual: { type: "Aperçu visuel", icon: "🖼️" },
  map: { type: "Carte", icon: "🗺️" },
};

type ActiveTab = number | "map";

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
  confirmArtefactProposal: (proposalId: string, decision: "add" | "dismiss") => void;
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
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;

  // Recharge les gents publiés depuis ce navigateur (localStorage) — n'existe
  // pas encore côté serveur/premier rendu, d'où le placeholder FALLBACK_ESPACE.
  useEffect(() => {
    const published = readPublishedGents();
    if (Object.keys(published).length) {
      setEspaces((prev) => ({ ...prev, ...published }));
    }
  }, []);

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
    const userMsg = { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: "à l'instant" };
    const agentPlaceholder = { role: "agent" as const, text: "", t: "à l'instant" };

    // L'updater doit rester pur (pas d'effet de bord dedans, sinon React peut
    // l'appeler deux fois en StrictMode/dev) : on capture juste ce qu'il faut
    // pour l'appel API dans ces variables, le streaming se fait après, en dehors.
    let history: { role: string; content: string }[] = [];
    let systemPrompt = "";
    let chatModelId = "anthropic/claude-sonnet-5";
    let threadId = "";
    let mcpServers: { name: string; url: string }[] | undefined;
    let webSearch: boolean | undefined;

    setEspaces((prev) => {
      const espace = prev[id];
      threadId = espace.activeConversationId;
      mcpServers = espace.mcpServers;
      webSearch = espace.webSearch;
      const thread = espace.conversations.find((t) => t.id === threadId);
      const priorMessages = [...(thread?.messages ?? []), userMsg];
      history = priorMessages.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: (m.text ?? "").replace(/<[^>]+>/g, ""),
      }));

      const basePrompt =
        espace.systemPrompt?.trim() || `Tu es l'assistant IA de Getgents pour l'espace "${espace.name}".`;
      const memoryNote = espace.memory ? `\n\nMémoire de l'espace : ${espace.memory}` : "";
      systemPrompt = `${basePrompt}${memoryNote}\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}\n\n${ARTEFACT_PROMPT_INSTRUCTION}`;
      chatModelId = espace.chatModelId ?? chatModelId;

      const conversations = espace.conversations.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, userMsg, agentPlaceholder] } : t
      );
      return { ...prev, [id]: { ...espace, conversations } };
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
          msgs.splice(Math.max(msgs.length - 1, 0), 0, { role: "tool" as const, kind, what, ok, t: "à l'instant" });
          return { ...t, messages: msgs };
        });
        return { ...p, [id]: { ...e, conversations: convs } };
      });
    }

    streamChatCompletion(
      {
        model: chatModelId,
        messages: [{ role: "system", content: systemPrompt }, ...history],
        max_tokens: 2048,
        reasoning: { enabled: true },
        mcpServers,
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
      .then(({ text: fullRaw, reasoning }) => {
        const afterQuestions = extractQuestions(fullRaw);
        const afterArtefact = extractArtefactSignal(afterQuestions.text);
        const finalHtml = renderMarkdown(afterArtefact.text);

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
                t: "à l'instant",
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
      })
      .catch((err: Error) => {
        updateLastMessage(() => ({
          role: "agent" as const,
          text: `<p>Erreur de connexion au service IA${err?.message ? ` : ${err.message}` : ""}.</p>`,
          t: "à l'instant",
        }));
      })
      .finally(() => setIsThinking(false));
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
        confirmArtefactProposal,
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
