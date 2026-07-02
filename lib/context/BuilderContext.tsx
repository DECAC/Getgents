"use client";

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { GentDraft, GentDraftsMap, ModelCapability, ConnectorToolKind, KnowledgeSourceKind } from "@/lib/types/builder";
import { GENT_DRAFTS, CONNECTOR_TOOL_TYPES, MODEL_CATALOG } from "@/lib/mock-data/builder";
import { extractQuestions, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";

export type BuilderTab = "prompt" | "connectors" | "artefacts";

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

  toggleArtefactTemplate: (templateId: string) => void;

  sendBuilderMessage: (text: string) => void;
  applyBuilderSuggestion: (suggestion: string) => void;
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
  "Dès que l'objectif ou les instructions données par le créateur laissent deviner un besoin particulier (raisonnement complexe, génération d'image, restitution vocale, budget serré, gros volume de texte...), recommande explicitement, capacité par capacité, le ou les modèles les plus adaptés parmi cette liste, en une phrase de justification. Le créateur les active ensuite lui-même via les listes déroulantes de la section « Modèles », dans l'onglet Prompt — tu ne peux pas les assigner à sa place.";

const BUILDER_ASSISTANT_REPLIES = [
  "Bien noté. J'ai reformulé ce point dans un langage plus directif pour le modèle — regardez le prompt mis à jour.",
  "Pour cet objectif, je recommande un modèle de raisonnement en plus du modèle de conversation : voulez-vous que je l'active dans la section Modèles du Prompt ?",
  "Cela ressemble à une action engageante (compte tiers). Pensez à ajouter le connecteur correspondant et à documenter l'invariant de confirmation dans le prompt.",
];

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
    setDrafts((prev) => ({ ...prev, [currentId]: { ...prev[currentId], name: text, updatedAt: "à l'instant" } }));
  }, [currentId]);

  const publishDraft = useCallback(() => {
    setDrafts((prev) => ({
      ...prev,
      [currentId]: { ...prev[currentId], status: "published", updatedAt: "à l'instant" },
    }));
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

  const toggleArtefactTemplate = useCallback((templateId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const artefactTemplates = draft.artefactTemplates.map((t) =>
        t.id === templateId ? { ...t, enabled: !t.enabled } : t
      );
      return { ...prev, [currentId]: { ...draft, artefactTemplates, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const sendBuilderMessage = useCallback((text: string) => {
    const id = currentIdRef.current;

    setDrafts((prev) => {
      const draft = prev[id];
      const builderConversation = [
        ...draft.builderConversation,
        { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: "à l'instant" },
      ];
      return { ...prev, [id]: { ...draft, builderConversation } };
    });

    setIsThinking(true);

    setDrafts((prev) => {
      const draft = prev[id];
      const systemPrompt = `${
        draft.systemPrompt
          ? `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Voici son prompt système actuel :\n\n${draft.systemPrompt}\n\nAide le créateur à améliorer ce prompt et la configuration du gent.`
          : `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Aide le créateur à rédiger un prompt système efficace.`
      }\n\n${MODEL_RECOMMENDATION_INSTRUCTION}\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}`;

      const history = draft.builderConversation.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: (m.text ?? "").replace(/<[^>]+>/g, ""),
      }));

      const chatModelId =
        draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ??
        "anthropic/claude-sonnet-5";

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: chatModelId,
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: text },
          ],
          max_tokens: 2048,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const raw: string =
            data?.choices?.[0]?.message?.content ??
            `Erreur API : ${data?.error?.message ?? JSON.stringify(data)}`;
          const { text: reply, questions } = extractQuestions(raw);
          const safeReply = reply.replace(/</g, "&lt;").replace(/\n/g, "<br/>");
          setDrafts((p) => {
            const d = p[id];
            return {
              ...p,
              [id]: {
                ...d,
                builderConversation: [
                  ...d.builderConversation,
                  { role: "agent" as const, text: `<p>${safeReply}</p>`, t: "à l'instant", questions },
                ],
              },
            };
          });
        })
        .catch(() => {
          setDrafts((p) => {
            const d = p[id];
            return {
              ...p,
              [id]: {
                ...d,
                builderConversation: [
                  ...d.builderConversation,
                  { role: "agent" as const, text: "<p>Erreur de connexion au service IA.</p>", t: "à l'instant" },
                ],
              },
            };
          });
        })
        .finally(() => setIsThinking(false));

      return prev;
    });
  }, []);

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
        toggleArtefactTemplate,
        sendBuilderMessage,
        applyBuilderSuggestion,
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
