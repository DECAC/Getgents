"use client";

import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { GentDraft, GentDraftsMap, ModelCapability } from "@/lib/types/builder";
import { GENT_DRAFTS, CONNECTOR_CATALOG } from "@/lib/mock-data/builder";
import { extractQuestions, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import { writePublishedGent, draftToEspace } from "@/lib/publishedGents";

export type BuilderTab = "prompt" | "knowledge" | "models" | "connectors" | "artefacts";

interface BuilderContextValue {
  drafts: GentDraftsMap;
  currentId: string;
  currentDraft: GentDraft;
  activeTab: BuilderTab;

  switchDraft: (id: string) => void;
  switchTab: (tab: BuilderTab) => void;
  createDraft: () => string;

  updateObjective: (text: string) => void;
  updateSystemPrompt: (text: string) => void;
  updateName: (text: string) => void;
  publishDraft: () => void;

  assignModel: (capability: ModelCapability, modelId: string | null) => void;

  toggleConnector: (connectorId: string) => void;
  addConnector: (connectorId: string) => void;

  toggleArtefactTemplate: (templateId: string) => void;

  addKnowledgeFile: (name: string, size: string) => void;
  removeKnowledgeFile: (fileId: string) => void;
  addKnowledgeUrl: (url: string) => void;
  removeKnowledgeUrl: (urlId: string) => void;

  sendBuilderMessage: (text: string) => void;
  applyBuilderSuggestion: (suggestion: string) => void;
  isThinking: boolean;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

const BUILDER_ASSISTANT_REPLIES = [
  "Bien noté. J'ai reformulé ce point dans un langage plus directif pour le modèle — regardez le prompt mis à jour.",
  "Pour cet objectif, je recommande un modèle de raisonnement en plus du modèle de conversation : voulez-vous que je l'active dans l'onglet Modèles ?",
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
    setDrafts((prev) => {
      const published: GentDraft = { ...prev[currentId], status: "published", updatedAt: "à l'instant" };
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

  const toggleConnector = useCallback((connectorId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const connectors = draft.connectors.map((c) =>
        c.id === connectorId ? { ...c, connected: !c.connected } : c
      );
      return { ...prev, [currentId]: { ...draft, connectors, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const addConnector = useCallback((connectorId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      if (draft.connectors.some((c) => c.id === connectorId)) return prev;
      const entry = CONNECTOR_CATALOG.find((c) => c.id === connectorId);
      if (!entry) return prev;
      return {
        ...prev,
        [currentId]: {
          ...draft,
          connectors: [...draft.connectors, { ...entry, connected: true }],
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

  const addKnowledgeFile = useCallback((name: string, size: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const file = { id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, size };
      return { ...prev, [currentId]: { ...draft, knowledgeFiles: [...draft.knowledgeFiles, file], updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const removeKnowledgeFile = useCallback((fileId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      return {
        ...prev,
        [currentId]: {
          ...draft,
          knowledgeFiles: draft.knowledgeFiles.filter((f) => f.id !== fileId),
          updatedAt: "à l'instant",
        },
      };
    });
  }, [currentId]);

  const addKnowledgeUrl = useCallback((url: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const entry = { id: `ku-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url };
      return { ...prev, [currentId]: { ...draft, knowledgeUrls: [...draft.knowledgeUrls, entry], updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const removeKnowledgeUrl = useCallback((urlId: string) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      return {
        ...prev,
        [currentId]: {
          ...draft,
          knowledgeUrls: draft.knowledgeUrls.filter((u) => u.id !== urlId),
          updatedAt: "à l'instant",
        },
      };
    });
  }, [currentId]);

  const sendBuilderMessage = useCallback((text: string) => {
    const id = currentIdRef.current;
    const userMsg = { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: "à l'instant" };

    // L'updater doit rester pur (pas d'effet de bord dedans, sinon React peut
    // l'appeler deux fois en StrictMode/dev) : on capture juste ce qu'il faut
    // pour l'appel API dans ces variables, le fetch se fait après, en dehors.
    let history: { role: string; content: string }[] = [];
    let systemPrompt = "";
    let chatModelId = "anthropic/claude-sonnet-5";

    setDrafts((prev) => {
      const draft = prev[id];
      systemPrompt = `${
        draft.systemPrompt
          ? `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Voici son prompt système actuel :\n\n${draft.systemPrompt}\n\nAide le créateur à améliorer ce prompt et la configuration du gent.`
          : `Tu es un assistant expert en design de gents IA. Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Aide le créateur à rédiger un prompt système efficace.`
      }\n\n${SUGGESTIONS_PROMPT_INSTRUCTION}`;
      history = draft.builderConversation.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: (m.text ?? "").replace(/<[^>]+>/g, ""),
      }));
      chatModelId = draft.modelAssignments.find((a) => a.capability === "chat")?.modelId ?? chatModelId;

      const builderConversation = [...draft.builderConversation, userMsg];
      return { ...prev, [id]: { ...draft, builderConversation } };
    });

    setIsThinking(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModelId,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: text }],
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
        switchDraft,
        switchTab,
        createDraft,
        updateObjective,
        updateSystemPrompt,
        updateName,
        publishDraft,
        assignModel,
        toggleConnector,
        addConnector,
        toggleArtefactTemplate,
        addKnowledgeFile,
        removeKnowledgeFile,
        addKnowledgeUrl,
        removeKnowledgeUrl,
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
