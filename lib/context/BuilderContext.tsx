"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { GentDraft, GentDraftsMap, ModelCapability, ConnectorToolKind, KnowledgeSourceKind } from "@/lib/types/builder";
import type { ConversationMessage } from "@/lib/types";
import { GENT_DRAFTS, CONNECTOR_TOOL_TYPES, MODEL_CATALOG } from "@/lib/mock-data/builder";
import { extractQuestions, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import {
  CONNECTOR_PROMPT_INSTRUCTION,
  CONNECTOR_DISCOVERY_INSTRUCTION,
  extractConnectorSignal,
  extractConnectorSuggestions,
  detectConnectorInText,
  type ConnectorProposal,
} from "@/lib/connectorSignal";
import { GENT_CONFIG_PROMPT_INSTRUCTION, extractGentConfigSignal, type GentConfigProposal } from "@/lib/gentConfigSignal";
import { writePublishedGent, draftToEspace, patchPublishedGentName } from "@/lib/publishedGents";
import { draftContentSnapshot } from "@/lib/builderSnapshot";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion, CHAT_MAX_TOKENS } from "@/lib/streamChat";

export type BuilderTab = "prompt" | "connectors" | "artefacts" | "audit";

interface BuilderContextValue {
  drafts: GentDraftsMap;
  currentId: string;
  currentDraft: GentDraft;
  activeTab: BuilderTab;
  railCollapsed: boolean;

  switchDraft: (id: string) => void;
  switchTab: (tab: BuilderTab) => void;
  toggleRail: () => void;
  createDraft: () => string;

  updateObjective: (text: string) => void;
  updateSystemPrompt: (text: string) => void;
  updateName: (text: string) => void;
  publishDraft: () => void;

  assignModel: (capability: ModelCapability, modelId: string | null) => void;

  addKnowledgeSource: (kind: KnowledgeSourceKind, label: string, meta: string) => void;
  removeKnowledgeSource: (sourceId: string) => void;

  addToolInstance: (toolKind: ConnectorToolKind, options?: { name?: string; detail?: string }) => void;
  renameToolInstance: (instanceId: string, name: string) => void;
  removeToolInstance: (instanceId: string) => void;

  toggleWebSearch: () => void;

  sendBuilderMessage: (text: string) => void;
  applyBuilderSuggestion: (suggestion: string) => void;
  confirmConnectorProposal: (messageId: string, decision: "add" | "dismiss") => void;
  /** Applique (ou ignore) une configuration complète proposée par l'assistant. */
  applyGentConfig: (messageId: string, decision: "apply" | "dismiss") => void;
  /** Configure les connecteurs sélectionnés parmi les candidats découverts (urls), ou tout ignorer ([]). */
  confirmConnectorSuggestions: (messageId: string, selectedUrls: string[]) => void;
  isThinking: boolean;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

const MODEL_CAPABILITY_LABEL: Record<string, string> = {
  chat: "Conversation",
  reasoning: "Raisonnement approfondi",
  image: "Génération d'image",
  tts: "Synthèse vocale",
  stt: "Transcription vocale",
};

const MODEL_CATALOG_SUMMARY = MODEL_CATALOG.map(
  (m) =>
    `- [${MODEL_CAPABILITY_LABEL[m.capability] ?? m.capability}] ${m.label} (${m.provider}) — ${m.tagline} (env. $${m.pricing.input}/$${m.pricing.output} par 1M tokens en entrée/sortie)`
).join("\n");

const MODEL_RECOMMENDATION_INSTRUCTION =
  `Voici le catalogue des modèles disponibles pour ce gent (une seule clé API OpenRouter donne accès à tous) :\n${MODEL_CATALOG_SUMMARY}\n\n` +
  "Dès que l'objectif ou les instructions données par le créateur laissent deviner un besoin particulier (raisonnement complexe, génération d'image, restitution vocale, budget serré, gros volume de texte...), recommande explicitement, capacité par capacité, le ou les modèles les plus adaptés parmi cette liste, en une phrase de justification, et propose leur assignation via le bloc GENT_CONFIG (voir instruction dédiée).";

const BUILDER_ASSISTANT_REPLIES = [
  "Bien noté. J'ai reformulé ce point dans un langage plus directif pour le modèle — regardez le prompt mis à jour.",
  "Pour cet objectif, je recommande un modèle de raisonnement en plus du modèle de conversation : voulez-vous que je l'active dans la section Modèles du Prompt ?",
  "Cela ressemble à une action engageante (compte tiers). Pensez à ajouter le connecteur correspondant et à documenter l'invariant de confirmation dans le prompt.",
];

// Persistance des brouillons dans le navigateur : sans elle, un gent créé
// puis testé côté user disparaissait du gent studio au retour (état mémoire).
const DRAFTS_STORAGE_KEY = "getgents:gent-drafts";

function readStoredDrafts(): GentDraftsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GentDraftsMap) : {};
  } catch {
    return {};
  }
}

function seedDrafts(initialId: string): GentDraftsMap {
  const drafts: GentDraftsMap = JSON.parse(JSON.stringify(GENT_DRAFTS));
  if (!drafts[initialId]) {
    drafts[initialId] = {
      ...JSON.parse(JSON.stringify(drafts["nouveau-gent"])),
      id: initialId,
      updatedAt: "à l'instant",
    };
  }
  return drafts;
}

export function BuilderProvider({ children, initialId }: { children: ReactNode; initialId: string }) {
  const [drafts, setDrafts] = useState<GentDraftsMap>(() => seedDrafts(initialId));
  const [currentId, setCurrentId] = useState(initialId);
  const [activeTab, setActiveTab] = useState<BuilderTab>("prompt");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [replyCursor, setReplyCursor] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;
  const draftsLoadedRef = useRef(false);

  // Recharge les brouillons persistés (localStorage) puis sauvegarde chaque
  // changement — le premier rendu serveur n'y a pas accès, d'où le useEffect.
  useEffect(() => {
    const stored = readStoredDrafts();
    if (Object.keys(stored).length) {
      setDrafts((prev) => ({ ...prev, ...stored }));
    }
    draftsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftsLoadedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // quota dépassé / navigation privée : le studio reste utilisable en mémoire
    }
  }, [drafts]);

  const currentDraft = drafts[currentId];

  const switchDraft = useCallback((id: string) => {
    setCurrentId(id);
    setActiveTab("prompt");
  }, []);

  const switchTab = useCallback((tab: BuilderTab) => setActiveTab(tab), []);

  const toggleRail = useCallback(() => setRailCollapsed((v) => !v), []);

  const createDraft = useCallback((): string => {
    const id = `draft-${Date.now()}`;
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...JSON.parse(JSON.stringify(prev["nouveau-gent"])),
        id,
        updatedAt: "à l'instant",
      },
    }));
    return id;
  }, []);

  const updateObjective = useCallback((text: string) => {
    setDrafts((prev) => ({ ...prev, [currentId]: { ...prev[currentId], objective: text, updatedAt: "à l'instant" } }));
  }, [currentId]);

  const updateSystemPrompt = useCallback((text: string) => {
    setDrafts((prev) => ({ ...prev, [currentId]: { ...prev[currentId], systemPrompt: text, updatedAt: "à l'instant" } }));
  }, [currentId]);

  const updateName = useCallback((text: string) => {
    setDrafts((prev) => {
      const draft = { ...prev[currentId], name: text, updatedAt: "à l'instant" };
      if (draft.status === "published") {
        patchPublishedGentName(currentId, text);
      }
      return { ...prev, [currentId]: draft };
    });
  }, [currentId]);

  const publishDraft = useCallback(() => {
    setDrafts((prev) => {
      const draft = { ...prev[currentId], status: "published" as const, updatedAt: "à l'instant" };
      const published: GentDraft = { ...draft, publishedSnapshot: draftContentSnapshot(draft) };
      writePublishedGent(currentId, draftToEspace(published));
      return { ...prev, [currentId]: published };
    });
  }, [currentId]);

  const assignModel = useCallback((capability: ModelCapability, modelId: string | null) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const modelAssignments = draft.modelAssignments.map((a) =>
        a.capability === capability ? { ...a, modelId } : a
      );
      return { ...prev, [currentId]: { ...draft, modelAssignments, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const addKnowledgeSource = useCallback((kind: KnowledgeSourceKind, label: string, meta: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const source = { id: `know-${Date.now()}`, kind, label, meta };
      return {
        ...prev,
        [currentId]: { ...draft, knowledgeSources: [...draft.knowledgeSources, source], updatedAt: "à l'instant" },
      };
    });
  }, [currentId]);

  const removeKnowledgeSource = useCallback((sourceId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      return {
        ...prev,
        [currentId]: {
          ...draft,
          knowledgeSources: draft.knowledgeSources.filter((s) => s.id !== sourceId),
          updatedAt: "à l'instant",
        },
      };
    });
  }, [currentId]);

  const addToolInstance = useCallback((toolKind: ConnectorToolKind, options?: { name?: string; detail?: string }) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const type = CONNECTOR_TOOL_TYPES.find((t) => t.kind === toolKind);
      if (!type) return prev;
      let name = options?.name?.trim();
      if (!name) {
        const countSameKind = draft.connectors.filter((c) => c.toolKind === toolKind).length;
        name = countSameKind === 0 ? type.name : `${type.name} (${countSameKind + 1})`;
      }
      const instance = { id: `tool-${Date.now()}`, toolKind, name, detail: options?.detail };
      return {
        ...prev,
        [currentId]: { ...draft, connectors: [...draft.connectors, instance], updatedAt: "à l'instant" },
      };
    });
  }, [currentId]);

  const renameToolInstance = useCallback((instanceId: string, name: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const connectors = draft.connectors.map((c) => (c.id === instanceId ? { ...c, name } : c));
      return { ...prev, [currentId]: { ...draft, connectors, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const removeToolInstance = useCallback((instanceId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      return {
        ...prev,
        [currentId]: {
          ...draft,
          connectors: draft.connectors.filter((c) => c.id !== instanceId),
          updatedAt: "à l'instant",
        },
      };
    });
  }, [currentId]);

  const toggleWebSearch = useCallback(() => {
    setDrafts((prev) => ({
      ...prev,
      [currentId]: { ...prev[currentId], webSearch: !prev[currentId].webSearch, updatedAt: "à l'instant" },
    }));
  }, [currentId]);

  const sendBuilderMessage = useCallback((text: string) => {
    const id = currentIdRef.current;
    const userMsg = { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: "à l'instant" };
    const agentPlaceholder = { role: "agent" as const, text: "", t: "à l'instant" };

    // L'updater doit rester pur (pas d'effet de bord dedans, sinon React peut
    // l'appeler deux fois en StrictMode/dev) : on capture juste ce qu'il faut
    // pour l'appel API dans ces variables, le streaming se fait après, en dehors.
    let history: { role: string; content: string }[] = [];
    let systemPrompt = "";
    let chatModelId = "anthropic/claude-sonnet-5";
    let existingConnectorUrls: string[] = [];

    setDrafts((prev) => {
      const draft = prev[id];
      existingConnectorUrls = draft.connectors.map((c) => c.detail ?? "").filter(Boolean);
      const connectorsNote = draft.connectors.length
        ? `\n\nConnecteurs déjà configurés : ${draft.connectors.map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`).join(", ")}.`
        : "";
      systemPrompt = `${
        draft.systemPrompt
          ? `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Voici son prompt système actuel :\n\n${draft.systemPrompt}\n\nAide le créateur à améliorer ce prompt et la configuration du gent.`
          : `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Aide le créateur à rédiger un prompt système efficace.`
      }${connectorsNote}\n\n${MODEL_RECOMMENDATION_INSTRUCTION}\n\n${GENT_CONFIG_PROMPT_INSTRUCTION}\n\n${CONNECTOR_PROMPT_INSTRUCTION}\n\n${CONNECTOR_DISCOVERY_INSTRUCTION}\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}`;
      history = draft.builderConversation
        .filter((m) => m.role === "agent" || m.role === "user")
        .map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: (m.text ?? "").replace(/<[^>]+>/g, ""),
        }));
      chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? chatModelId;

      const builderConversation = [...draft.builderConversation, userMsg, agentPlaceholder];
      return { ...prev, [id]: { ...draft, builderConversation } };
    });

    setIsThinking(true);

    function updateLastMessage(updater: (m: ConversationMessage) => ConversationMessage) {
      setDrafts((p) => {
        const d = p[id];
        const msgs = [...d.builderConversation];
        const lastIdx = msgs.length - 1;
        if (lastIdx < 0) return p;
        msgs[lastIdx] = updater(msgs[lastIdx]);
        return { ...p, [id]: { ...d, builderConversation: msgs } };
      });
    }

    streamChatCompletion(
      {
        model: chatModelId,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: text }],
        max_tokens: CHAT_MAX_TOKENS.builder,
        // Recherche web en tâche de fond : l'assistant s'en sert pour
        // découvrir des connecteurs candidats (datasets, MCP, API).
        webSearch: true,
      },
      (fullSoFar) => {
        const displayRaw = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(displayRaw) }));
      }
    )
      .then(({ text: fullRaw, truncated }) => {
        const afterConfig = extractGentConfigSignal(fullRaw);
        const afterSuggestions = extractConnectorSuggestions(afterConfig.text);
        const afterConnector = extractConnectorSignal(afterSuggestions.text);
        const { text: reply, questions } = extractQuestions(afterConnector.text);
        const truncationNote = truncated
          ? "\n\n⚠️ *Réponse interrompue (limite de longueur atteinte). Relancez ou demandez « continue » pour obtenir la suite.*"
          : "";
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(reply + truncationNote), questions }));

        // Configuration complète proposée : carte « Appliquer la configuration ».
        if (afterConfig.config) {
          const config = afterConfig.config;
          setDrafts((p) => {
            const d = p[id];
            const msg = {
              id: `config-${Date.now()}`,
              role: "config-proposal" as const,
              configProposal: config,
              configProposalStatus: "pending" as const,
              t: "à l'instant",
            };
            return { ...p, [id]: { ...d, builderConversation: [...d.builderConversation, msg] } };
          });
        }

        // Connecteurs candidats découverts par recherche web : liste de
        // sélection à valider par le créateur. Ignorée si une configuration
        // complète a été proposée dans le même message (elle prime).
        const suggestions = afterConfig.config
          ? []
          : afterSuggestions.suggestions.filter((s) => !existingConnectorUrls.includes(s.url));
        if (suggestions.length) {
          setDrafts((p) => {
            const d = p[id];
            const msg = {
              id: `connlist-${Date.now()}`,
              role: "connector-proposal" as const,
              connectorSuggestions: suggestions,
              connectorSuggestionsStatus: "pending" as const,
              t: "à l'instant",
            };
            return { ...p, [id]: { ...d, builderConversation: [...d.builderConversation, msg] } };
          });
        }

        // Proposition de connecteur unique : signal du modèle, ou détection
        // déterministe de secours sur le message du créateur (URL de dataset).
        let proposal: ConnectorProposal | null = afterConnector.connector ?? detectConnectorInText(text);
        if (afterConfig.config) proposal = null;
        if (proposal && existingConnectorUrls.includes(proposal.url)) proposal = null;
        if (proposal && suggestions.some((s) => s.url === proposal!.url)) proposal = null;
        if (proposal) {
          const finalProposal = proposal;
          setDrafts((p) => {
            const d = p[id];
            const msg = {
              id: `conn-${Date.now()}`,
              role: "connector-proposal" as const,
              connectorProposal: finalProposal,
              connectorProposalStatus: "pending" as const,
              t: "à l'instant",
            };
            return { ...p, [id]: { ...d, builderConversation: [...d.builderConversation, msg] } };
          });
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

  // Validation (ou refus) d'un connecteur préparé par l'assistant du builder.
  const confirmConnectorProposal = useCallback((messageId: string, decision: "add" | "dismiss") => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const msg = draft.builderConversation.find((m) => m.id === messageId);
      if (!msg?.connectorProposal) return prev;

      let connectors = draft.connectors;
      if (decision === "add") {
        connectors = [
          ...connectors,
          {
            id: `tool-${Date.now()}`,
            toolKind: msg.connectorProposal.kind,
            name: msg.connectorProposal.name,
            detail: msg.connectorProposal.url,
          },
        ];
      }
      const builderConversation = draft.builderConversation.map((m) =>
        m.id === messageId
          ? { ...m, connectorProposalStatus: decision === "add" ? ("added" as const) : ("dismissed" as const) }
          : m
      );
      return { ...prev, [currentId]: { ...draft, connectors, builderConversation, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  // Applique en une fois la configuration proposée par l'assistant (nom,
  // objectif, prompt, modèles, recherche web, connecteurs).
  const applyGentConfig = useCallback((messageId: string, decision: "apply" | "dismiss") => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const msg = draft.builderConversation.find((m) => m.id === messageId);
      const cfg: GentConfigProposal | undefined = msg?.configProposal;
      if (!cfg) return prev;

      let next = { ...draft, updatedAt: "à l'instant" };
      if (decision === "apply") {
        if (cfg.name) next.name = cfg.name;
        if (cfg.objective) next.objective = cfg.objective;
        if (cfg.systemPrompt) next.systemPrompt = cfg.systemPrompt;
        if (cfg.webSearch !== undefined) next.webSearch = cfg.webSearch;
        if (cfg.chatModelId || cfg.reasoningModelId) {
          next.modelAssignments = next.modelAssignments.map((a) => {
            if (a.capability === "chat" && cfg.chatModelId) return { ...a, modelId: cfg.chatModelId };
            if (a.capability === "reasoning" && cfg.reasoningModelId) return { ...a, modelId: cfg.reasoningModelId };
            return a;
          });
        }
        if (cfg.connectors?.length) {
          const existingUrls = next.connectors.map((c) => c.detail);
          next.connectors = [
            ...next.connectors,
            ...cfg.connectors
              .filter((c) => !existingUrls.includes(c.url))
              .map((c, i) => ({ id: `tool-${Date.now()}-${i}`, toolKind: c.kind, name: c.name, detail: c.url })),
          ];
        }
        if (cfg.name && draft.status === "published") {
          patchPublishedGentName(currentId, cfg.name);
        }
      }

      next.builderConversation = next.builderConversation.map((m) =>
        m.id === messageId
          ? { ...m, configProposalStatus: decision === "apply" ? ("applied" as const) : ("dismissed" as const) }
          : m
      );
      return { ...prev, [currentId]: next };
    });
  }, [currentId]);

  // Configure les connecteurs sélectionnés parmi les candidats découverts.
  const confirmConnectorSuggestions = useCallback((messageId: string, selectedUrls: string[]) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const msg = draft.builderConversation.find((m) => m.id === messageId);
      if (!msg?.connectorSuggestions) return prev;

      const selected = msg.connectorSuggestions.filter((s) => selectedUrls.includes(s.url));
      const connectors = [
        ...draft.connectors,
        ...selected.map((s, i) => ({
          id: `tool-${Date.now()}-${i}`,
          toolKind: s.kind,
          name: s.name,
          detail: s.url,
        })),
      ];
      const builderConversation = draft.builderConversation.map((m) =>
        m.id === messageId
          ? { ...m, connectorSuggestionsStatus: selected.length ? ("applied" as const) : ("dismissed" as const) }
          : m
      );
      return { ...prev, [currentId]: { ...draft, connectors, builderConversation, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const applyBuilderSuggestion = useCallback((suggestion: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const nextPrompt = draft.systemPrompt ? `${draft.systemPrompt}\n\n${suggestion}` : suggestion;
      return { ...prev, [currentId]: { ...draft, systemPrompt: nextPrompt, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  return (
    <BuilderContext.Provider
      value={{
        drafts,
        currentId,
        currentDraft,
        activeTab,
        railCollapsed,
        switchDraft,
        switchTab,
        toggleRail,
        createDraft,
        updateObjective,
        updateSystemPrompt,
        updateName,
        publishDraft,
        assignModel,
        addKnowledgeSource,
        removeKnowledgeSource,
        addToolInstance,
        renameToolInstance,
        removeToolInstance,
        toggleWebSearch,
        sendBuilderMessage,
        applyBuilderSuggestion,
        confirmConnectorProposal,
        confirmConnectorSuggestions,
        applyGentConfig,
        isThinking,
      }}
    >
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used within BuilderProvider");
  return ctx;
}
