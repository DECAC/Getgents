"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { GentDraft, GentDraftsMap, ModelCapability, ConnectorToolKind, KnowledgeSourceKind } from "@/lib/types/builder";
import type { ConversationMessage, RestApiToolConfig, JumpForm, Routine, NotificationChannel, Espace } from "@/lib/types";
import { GENT_DRAFTS, CONNECTOR_TOOL_TYPES, BUILDER_ASSISTANT_MODEL_ID } from "@/lib/mock-data/builder";
import { supportsReasoningStream } from "@/lib/openRouterReasoning";
import { extractQuestions, recoverQuestionsFromChoiceList, stripVisibleChoiceList } from "@/lib/suggestions";
import {
  extractConnectorSignal,
  extractConnectorSuggestions,
  detectConnectorInText,
  type ConnectorProposal,
} from "@/lib/connectorSignal";
import { extractGentConfigSignal, type GentConfigProposal } from "@/lib/gentConfigSignal";
import { extractJumpFormSignal } from "@/lib/jumpFormSignal";
import {
  extractAppPreviewSignal,
  mergeAppPreview,
  buildAppPreviewSystemPrompt,
  buildAppPreviewEvolveSystemPrompt,
} from "@/lib/appPreview";
import {
  buildBuilderSystemPrompt,
  frameBuilderObjectiveMessage,
  isBuilderObjectiveSeedTurn,
} from "@/lib/builderAssistantPrompt";
import {
  writePublishedGent,
  draftToEspace,
  patchPublishedGentName,
  patchPublishedGentIcon,
  readPublishedGents,
  mergeVisionneuseArtefact,
} from "@/lib/publishedGents";
import { draftContentSnapshot } from "@/lib/builderSnapshot";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion, CHAT_MAX_TOKENS, defaultStatusLabel } from "@/lib/streamChat";
import {
  DRAFTS_STORAGE_KEY,
  clearStoredPendingBuilderMessage,
  freshDraftFromTemplate,
  createDraftId,
  draftsForPersistence,
  mergeStoredDrafts,
  readStoredDrafts,
  seedDrafts,
  syncDraftsFromRemote,
  pushRemoteDraft,
  writeStoredDrafts,
} from "@/lib/builderDraftStorage";

export type BuilderTab =
  | "accueil"
  | "mesgents"
  | "conversationnel"
  | "miniapp"
  | "visionneuse"
  | "apercu"
  | "connectors"
  | "knowledge"
  | "audit"
  | "diffusion"
  | "marketing";

interface BuilderContextValue {
  drafts: GentDraftsMap;
  currentId: string;
  currentDraft: GentDraft;
  activeTab: BuilderTab;
  railCollapsed: boolean;
  /** Panneau assistant entièrement réduit (clic sur la poignée). */
  assistantCollapsed: boolean;

  switchDraft: (id: string) => void;
  switchTab: (tab: BuilderTab) => void;
  toggleRail: () => void;
  toggleAssistant: () => void;
  createDraft: () => string;

  updateObjective: (text: string) => void;
  updateSystemPrompt: (text: string) => void;
  updateName: (text: string) => void;
  /** Change l'emblème (emoji) du gent — bandeau, liste, rail utilisateur. */
  updateIcon: (icon: string) => void;
  publishDraft: () => void;
  /** Écrit la version de travail (Preview) sans toucher à la version diffusée. */
  syncWorkingVersion: () => void;

  assignModel: (capability: ModelCapability, modelId: string | null) => void;

  addKnowledgeSource: (kind: KnowledgeSourceKind, label: string, meta: string, text?: string, truncated?: boolean) => void;
  removeKnowledgeSource: (sourceId: string) => void;

  addToolInstance: (
    toolKind: ConnectorToolKind,
    options?: { name?: string; detail?: string; restConfig?: RestApiToolConfig }
  ) => void;
  renameToolInstance: (instanceId: string, name: string) => void;
  updateToolInstance: (
    instanceId: string,
    patch: { name?: string; detail?: string; restConfig?: RestApiToolConfig }
  ) => void;
  removeToolInstance: (instanceId: string) => void;

  toggleWebSearch: () => void;
  /** Active ou non le téléchargement de fichiers côté lecteur, et son formulaire. */
  updateFileDownload: (patch: { fileDownloadEnabled?: boolean; fileDownloadFormEnabled?: boolean }) => void;
  /** Modifie la routine planifiée du brouillon (patch partiel). */
  updateRoutine: (patch: Partial<Routine>) => void;
  /** Modifie le canal de diffusion du brouillon (patch partiel). */
  updateChannel: (patch: Partial<NotificationChannel>) => void;
  /** Modifie l'artefact figé « mini-app » du brouillon (patch partiel). */
  updatePinnedArtefact: (patch: Partial<import("@/lib/types").PinnedArtefact>) => void;
  /** Modifie la configuration du gent « visionneuse » du brouillon (patch partiel). */
  updateVisionneuse: (patch: Partial<import("@/lib/types").VisionneuseConfig>) => void;
  /** Efface l'aperçu d'application pour repartir d'une page blanche. */
  clearAppPreview: () => void;

  sendBuilderMessage: (
    text: string,
    opts?: { knowledgeFile?: { name: string; text: string; truncated?: boolean }; mode?: "apercu" | "apercu-ask" }
  ) => void;
  /** Vide le fil courant pour démarrer un nouvel échange avec l'assistant. */
  startNewBuilderConversation: () => void;
  applyBuilderSuggestion: (suggestion: string) => void;
  confirmConnectorProposal: (messageId: string, decision: "add" | "dismiss") => void;
  /** Applique (ou ignore) une configuration complète proposée par l'assistant. */
  applyGentConfig: (messageId: string, decision: "apply" | "dismiss") => void;
  /** Configure les connecteurs sélectionnés parmi les candidats découverts (urls), ou tout ignorer ([]). */
  confirmConnectorSuggestions: (messageId: string, selectedUrls: string[]) => void;
  /** Applique (ou ignore) un formulaire jump proposé par l'assistant. */
  applyJumpForm: (messageId: string, decision: "apply" | "dismiss") => void;
  isThinking: boolean;
  thinkingStatus: string | null;
  /** Interrompt la génération en cours (bouton Stop du composer). */
  stopGeneration: () => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

/** Une valeur « à fournir » : vide, ou référence à une variable d'environnement. */
function isEnvOrEmpty(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t === "" || /^env:/i.test(t) || /^\$\{/.test(t);
}

/**
 * Fusionne une nouvelle config REST proposée par l'assistant avec l'existante,
 * en préservant les secrets déjà saisis par l'utilisateur (clé d'auth et
 * valeurs de paramètres) : sinon une correction de structure écraserait la clé
 * que le créateur vient de coller par un placeholder env:.
 */
function mergeRestConfigSecrets(next: RestApiToolConfig, prev?: RestApiToolConfig): RestApiToolConfig {
  if (!prev) return next;
  const merged: RestApiToolConfig = { ...next };

  if (
    merged.auth?.mode === "api-key" &&
    prev.auth?.mode === "api-key" &&
    merged.auth.fieldName === prev.auth.fieldName &&
    isEnvOrEmpty(merged.auth.value) &&
    !isEnvOrEmpty(prev.auth.value)
  ) {
    merged.auth = { ...merged.auth, value: prev.auth.value };
  }

  merged.queryParams = merged.queryParams.map((q) => {
    if (!isEnvOrEmpty(q.value)) return q;
    const prevQ = prev.queryParams.find((p) => p.name === q.name);
    return prevQ && !isEnvOrEmpty(prevQ.value) ? { ...q, value: prevQ.value } : q;
  });

  return merged;
}

/**
 * La configuration de l'artefact figé a-t-elle changé d'une publication à
 * l'autre ? On compare la mission (« prompt figé ») et la structure des entrées
 * (identifiants, libellés, types) — pas leurs valeurs, qui appartiennent à
 * l'utilisateur.
 */
function pinnedConfigChanged(
  fresh: NonNullable<import("@/lib/types").PinnedArtefact>,
  existing?: import("@/lib/types").PinnedArtefact
): boolean {
  if (!existing) return true;
  if (fresh.mission.trim() !== existing.mission.trim()) return true;
  if (fresh.title.trim() !== existing.title.trim()) return true;
  const shape = (p: import("@/lib/types").PinnedArtefact) =>
    p.inputs.map((i) => `${i.id}|${i.kind}|${i.label}`).join("~");
  return shape(fresh) !== shape(existing);
}

const BUILDER_ASSISTANT_REPLIES = [
  "Bien noté. J'ai reformulé ce point dans un langage plus directif pour le modèle — regardez le prompt mis à jour.",
  "Pour cet objectif, je recommande un modèle de raisonnement en plus du modèle de conversation : voulez-vous que je l'active dans la section Modèles du Prompt ?",
  "Cela ressemble à une action engageante (compte tiers). Pensez à ajouter le connecteur correspondant et à documenter l'invariant de confirmation dans le prompt.",
];

export function BuilderProvider({
  children,
  initialId,
  initialTab,
}: {
  children: ReactNode;
  initialId: string;
  initialTab?: BuilderTab;
}) {
  const [drafts, setDrafts] = useState<GentDraftsMap>(() => seedDrafts(initialId));
  const [currentId, setCurrentId] = useState(initialId);
  const [activeTab, setActiveTab] = useState<BuilderTab>(initialTab ?? "accueil");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [replyCursor, setReplyCursor] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const currentIdRef = useRef(currentId);
  // Miroir des brouillons pour les callbacks qui doivent lire l'état courant
  // sans se re-créer à chaque frappe (syncWorkingVersion, appelé par Preview).
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  currentIdRef.current = currentId;
  const [storageReady, setStorageReady] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  /** Après « Faire évoluer », le prochain message (clic ou Autre) applique l'aperçu. */
  const apercuAskPendingRef = useRef(false);
  const prevInitialIdRef = useRef(initialId);

  // Changement de gent via l'URL (/builder/[gentId]) : le Provider n'est pas
  // remonté par Next.js, donc currentId doit suivre initialId — sinon
  // l'assistant affiche encore la conversation du gent précédent.
  useEffect(() => {
    if (prevInitialIdRef.current === initialId) return;
    prevInitialIdRef.current = initialId;

    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsThinking(false);
    setThinkingStatus(null);
    setReplyCursor(0);
    setCurrentId(initialId);
    setActiveTab(initialTab ?? "accueil");
    setDrafts((prev) => {
      if (prev[initialId]) return prev;
      const stored = readStoredDrafts();
      if (stored[initialId]) return { ...prev, [initialId]: stored[initialId] };
      return { ...prev, [initialId]: freshDraftFromTemplate(initialId) };
    });
  }, [initialId, initialTab]);

  const stopGeneration = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  // Recharge les brouillons : d'abord le cache localStorage (instantané), puis
  // le serveur (source de vérité) qui l'écrase s'il est disponible. On attend
  // que cette fusion soit appliquée avant toute écriture — sinon le premier
  // save écrase le stockage avec les seuls mock data (perte des gents custom).
  useEffect(() => {
    setDrafts((prev) => mergeStoredDrafts(prev));
    let cancelled = false;
    syncDraftsFromRemote()
      .then((merged) => {
        if (cancelled || merged === "unauthorized" || !merged || !Object.keys(merged).length) return;
        setDrafts((prev) => ({ ...prev, ...merged }));
      })
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistance : cache local immédiat + écriture serveur débouncée, pour que
  // tout gent créé ou édité survive au navigateur et à la machine.
  const lastPersistedRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    const persistable = draftsForPersistence(drafts);
    try {
      window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(persistable));
    } catch {
      // quota dépassé / navigation privée : le studio reste utilisable en mémoire
    }
    // N'envoie au serveur que les brouillons réellement modifiés (l'effet se
    // déclenche à chaque frappe, mais un seul brouillon change à la fois).
    for (const [id, draft] of Object.entries(persistable)) {
      const serialized = JSON.stringify(draft);
      if (lastPersistedRef.current[id] === serialized) continue;
      lastPersistedRef.current[id] = serialized;
      pushRemoteDraft(id, draft);
    }
  }, [drafts, storageReady]);

  const currentDraft = drafts[currentId] ?? freshDraftFromTemplate(currentId);

  const switchDraft = useCallback((id: string) => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsThinking(false);
    setThinkingStatus(null);
    setReplyCursor(0);
    setCurrentId(id);
    setDrafts((prev) => {
      if (prev[id]) return prev;
      const stored = readStoredDrafts();
      if (stored[id]) return { ...prev, [id]: stored[id] };
      return { ...prev, [id]: freshDraftFromTemplate(id) };
    });
    setActiveTab("accueil");
  }, []);

  const switchTab = useCallback((tab: BuilderTab) => setActiveTab(tab), []);

  const toggleRail = useCallback(() => setRailCollapsed((v) => !v), []);

  const toggleAssistant = useCallback(() => setAssistantCollapsed((v) => !v), []);

  const createDraft = useCallback((): string => {
    const id = createDraftId();
    const draft = freshDraftFromTemplate(id);
    setDrafts((prev) => ({
      ...prev,
      [id]: draft,
    }));
    const stored = readStoredDrafts();
    stored[id] = draft;
    writeStoredDrafts(stored);
    pushRemoteDraft(id, draft);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsThinking(false);
    setThinkingStatus(null);
    setReplyCursor(0);
    setCurrentId(id);
    prevInitialIdRef.current = id;
    setActiveTab("accueil");
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

  const updateIcon = useCallback((icon: string) => {
    setDrafts((prev) => {
      const draft = { ...prev[currentId], icon, updatedAt: "à l'instant" };
      if (draft.status === "published") {
        patchPublishedGentIcon(currentId, icon);
      }
      return { ...prev, [currentId]: draft };
    });
  }, [currentId]);

  /**
   * Fabrique l'espace à partir du brouillon courant, en préservant l'activité
   * utilisateur déjà persistée (conversations, artefacts, profil, mémoire,
   * historique de routine) : seule la CONFIGURATION est remplacée.
   */
  const buildEspaceFromDraft = useCallback(
    (draft: GentDraft): Espace => {
      const fresh = draftToEspace(draft);
      const existing = readPublishedGents()[currentId];
      if (!existing) return fresh;
      return {
        ...fresh,
        version: (existing.version ?? 1) + 1,
        conversations: existing.conversations?.length ? existing.conversations : fresh.conversations,
        activeConversationId: existing.conversations?.length
          ? existing.activeConversationId
          : fresh.activeConversationId,
        // Les artefacts appartiennent à l'utilisateur : republier ne doit pas
        // effacer son travail. Le document d'un gent « visionneuse » fait
        // exception — il relève de la CONFIGURATION du gent, pas de l'usage.
        // Sans cette fusion, attacher un document à un gent existant restait
        // sans effet : l'artefact fraîchement produit était écrasé par la
        // liste d'artefacts d'avant, et la visionneuse n'avait rien à ouvrir.
        artefacts: mergeVisionneuseArtefact(existing.artefacts ?? fresh.artefacts, fresh.artefacts),
        themeTabs: existing.themeTabs,
        memory: existing.memory || fresh.memory,
        profile: existing.profile,
        routine: fresh.routine
          ? { ...fresh.routine, lastRunAt: existing.routine?.lastRunAt, lastRunNote: existing.routine?.lastRunNote }
          : undefined,
        channel: fresh.channel
          ? { ...fresh.channel, lastDeliveryNote: existing.channel?.lastDeliveryNote }
          : undefined,
        // Artefact figé : quand la mission ou les entrées ont changé, le
        // rendu précédent a été produit par une configuration obsolète — on
        // repart d'une ardoise vierge pour que la nouvelle version soit
        // réellement testable. Sinon (renommage…) on conserve le généré.
        pinnedArtefact: fresh.pinnedArtefact
          ? pinnedConfigChanged(fresh.pinnedArtefact, existing.pinnedArtefact)
            ? { ...fresh.pinnedArtefact, runs: existing.pinnedArtefact?.runs }
            : {
                ...fresh.pinnedArtefact,
                dashboard: existing.pinnedArtefact?.dashboard,
                generatedAt: existing.pinnedArtefact?.generatedAt,
                runs: existing.pinnedArtefact?.runs,
                inputs: fresh.pinnedArtefact.inputs.map((i) => ({
                  ...i,
                  value: existing.pinnedArtefact?.inputs.find((e) => e.id === i.id)?.value ?? i.value,
                })),
              }
          : undefined,
      };
    },
    [currentId]
  );

  /**
   * Version de TRAVAIL : écrite avant chaque Preview, sans toucher au statut
   * ni à la version diffusée. C'est ce qui garantit que Preview part toujours
   * de la configuration à l'instant — une nouvelle entrée de mini-app, un
   * prompt modifié — au lieu de recharger la dernière version publiée.
   */
  const syncWorkingVersion = useCallback(() => {
    const draft = draftsRef.current[currentId];
    if (!draft) return;
    // Envoi immédiat (pas de débounce) : Preview ouvre un nouvel onglet, et un
    // push différé serait annulé ou arriverait après le chargement de l'espace.
    writePublishedGent(currentId, buildEspaceFromDraft(draft), true);
  }, [currentId, buildEspaceFromDraft]);

  /**
   * Diffusion : fige la version que verront les destinataires sur les canaux
   * (lien de partage, iframe, WhatsApp, routine). Distincte de la version de
   * travail — c'est le seul geste qui change ce que voient les utilisateurs.
   */
  const publishDraft = useCallback(() => {
    setDrafts((prev) => {
      const draft = { ...prev[currentId], status: "published" as const, updatedAt: "à l'instant" };
      const published: GentDraft = { ...draft, publishedSnapshot: draftContentSnapshot(draft) };
      writePublishedGent(currentId, buildEspaceFromDraft(published), true, true);
      return { ...prev, [currentId]: published };
    });
  }, [currentId, buildEspaceFromDraft]);

  const assignModel = useCallback((capability: ModelCapability, modelId: string | null) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const modelAssignments = draft.modelAssignments.map((a) =>
        a.capability === capability ? { ...a, modelId } : a
      );
      return { ...prev, [currentId]: { ...draft, modelAssignments, updatedAt: "à l'instant" } };
    });
  }, [currentId]);

  const addKnowledgeSource = useCallback((kind: KnowledgeSourceKind, label: string, meta: string, text?: string, truncated?: boolean) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const source = { id: `know-${Date.now()}`, kind, label, meta, text, truncated };
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

  const addToolInstance = useCallback(
    (toolKind: ConnectorToolKind, options?: { name?: string; detail?: string; restConfig?: RestApiToolConfig }) => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const type = CONNECTOR_TOOL_TYPES.find((t) => t.kind === toolKind);
      if (!type) return prev;
      let name = options?.name?.trim();
      if (!name) {
        const countSameKind = draft.connectors.filter((c) => c.toolKind === toolKind).length;
        name = countSameKind === 0 ? type.name : `${type.name} (${countSameKind + 1})`;
      }
      const instance = { id: `tool-${Date.now()}`, toolKind, name, detail: options?.detail, restConfig: options?.restConfig };
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

  const updateToolInstance = useCallback(
    (instanceId: string, patch: { name?: string; detail?: string; restConfig?: RestApiToolConfig }) => {
      setDrafts((prev) => {
        const draft = prev[currentId];
        const connectors = draft.connectors.map((c) => (c.id === instanceId ? { ...c, ...patch } : c));
        return { ...prev, [currentId]: { ...draft, connectors, updatedAt: "à l'instant" } };
      });
    },
    [currentId]
  );

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

  const updateFileDownload = useCallback(
    (patch: { fileDownloadEnabled?: boolean; fileDownloadFormEnabled?: boolean }) => {
      setDrafts((prev) => {
        const draft = prev[currentId];
        const fileDownloadEnabled = patch.fileDownloadEnabled ?? !!draft.fileDownloadEnabled;
        return {
          ...prev,
          [currentId]: {
            ...draft,
            fileDownloadEnabled,
            fileDownloadFormEnabled: fileDownloadEnabled
              ? (patch.fileDownloadFormEnabled ?? !!draft.fileDownloadFormEnabled)
              : draft.fileDownloadFormEnabled,
            updatedAt: "à l'instant",
          },
        };
      });
    },
    [currentId]
  );

  // Artefact figé « mini-app » : patch partiel fusionné sur la config du brouillon.
  const updatePinnedArtefact = useCallback(
    (patch: Partial<import("@/lib/types").PinnedArtefact>) => {
      setDrafts((prev) => {
        const current = prev[currentId].pinnedArtefact ?? {
          enabled: false,
          title: "",
          mission: "",
          inputs: [],
        };
        return {
          ...prev,
          [currentId]: { ...prev[currentId], pinnedArtefact: { ...current, ...patch }, updatedAt: "à l'instant" },
        };
      });
    },
    [currentId]
  );

  // Type de gent « visionneuse » : patch partiel fusionné sur la config du brouillon.
  const updateVisionneuse = useCallback(
    (patch: Partial<import("@/lib/types").VisionneuseConfig>) => {
      setDrafts((prev) => {
        const current = prev[currentId].visionneuse ?? { enabled: false, instructions: "" };
        return {
          ...prev,
          [currentId]: { ...prev[currentId], visionneuse: { ...current, ...patch }, updatedAt: "à l'instant" },
        };
      });
    },
    [currentId]
  );

  const clearAppPreview = useCallback(() => {
    setDrafts((prev) => ({
      ...prev,
      [currentId]: { ...prev[currentId], appPreview: undefined, appPreviewFreshIds: undefined },
    }));
  }, [currentId]);

  // Canal de diffusion : patch partiel fusionné sur le canal du brouillon.
  const updateChannel = useCallback(
    (patch: Partial<NotificationChannel>) => {
      setDrafts((prev) => {
        const current = prev[currentId].channel ?? {
          kind: "whatsapp" as const,
          enabled: false,
          to: "",
        };
        return {
          ...prev,
          [currentId]: { ...prev[currentId], channel: { ...current, ...patch }, updatedAt: "à l'instant" },
        };
      });
    },
    [currentId]
  );

  // Routine planifiée : patch partiel fusionné sur la routine du brouillon
  // (valeurs par défaut posées à la première modification).
  const updateRoutine = useCallback(
    (patch: Partial<Routine>) => {
      setDrafts((prev) => {
        const current = prev[currentId].routine ?? {
          enabled: false,
          frequency: "daily" as const,
          hour: 8,
          mission: "",
        };
        return {
          ...prev,
          [currentId]: { ...prev[currentId], routine: { ...current, ...patch }, updatedAt: "à l'instant" },
        };
      });
    },
    [currentId]
  );

  const sendBuilderMessage = useCallback((
    text: string,
    opts?: { knowledgeFile?: { name: string; text: string; truncated?: boolean }; mode?: "apercu" | "apercu-ask" }
  ) => {
    if (streamAbortRef.current) return; // une génération est déjà en cours
    const id = currentIdRef.current;
    const askTurn = opts?.mode === "apercu-ask";
    const followApercu = !askTurn && !opts?.mode && apercuAskPendingRef.current;
    const previewTurn = opts?.mode === "apercu" || followApercu;
    apercuAskPendingRef.current = askTurn;
    const userMsg = { role: "user" as const, text: `<p>${text.replace(/</g, "&lt;")}</p>`, t: "à l'instant" };
    const agentPlaceholder = { role: "agent" as const, text: "", t: "à l'instant" };

    // L'updater doit rester pur (pas d'effet de bord dedans, sinon React peut
    // l'appeler deux fois en StrictMode/dev) : on capture juste ce qu'il faut
    // pour l'appel API dans ces variables, le streaming se fait après, en dehors.
    let history: { role: string; content: string }[] = [];
    let systemPrompt = "";
    let chatModelId = BUILDER_ASSISTANT_MODEL_ID;
    let existingConnectorUrls: string[] = [];
    // Texte envoyé au modèle : sur le 1er tour d'objectif, on cadre explicitement
    // (sinon une phrase comme « analyse DPE… » est traitée comme une question métier).
    let apiUserContent = text;

    setDrafts((prev) => {
      const draft = prev[id];
      const knowledgeFile = opts?.knowledgeFile;
      const nextDraft = knowledgeFile
        ? {
            ...draft,
            knowledgeSources: [
              ...draft.knowledgeSources,
              {
                id: `know-${Date.now()}`,
                kind: "file" as const,
                label: knowledgeFile.name,
                meta: `${knowledgeFile.text.length.toLocaleString("fr-FR")} caractères · ajouté à l'instant${
                  knowledgeFile.truncated ? " · tronqué" : ""
                }`,
                text: knowledgeFile.text,
                truncated: knowledgeFile.truncated,
              },
            ],
          }
        : draft;
      existingConnectorUrls = nextDraft.connectors.map((c) => c.detail ?? "").filter(Boolean);
      // Un fichier de connaissance n'est pas un objectif : ne pas le cadrer
      // comme « mission du gent » ni l'écrire dans le champ Objectif.
      // Idem pour le bouton Aperçu : ce n'est pas une mission à configurer.
      const seedObjective = !knowledgeFile && !previewTurn && !askTurn && isBuilderObjectiveSeedTurn(nextDraft);
      systemPrompt = askTurn
        ? buildAppPreviewEvolveSystemPrompt(nextDraft)
        : previewTurn
          ? buildAppPreviewSystemPrompt(nextDraft)
          : buildBuilderSystemPrompt(nextDraft);
      if (seedObjective) {
        apiUserContent = frameBuilderObjectiveMessage(text);
      } else if (followApercu) {
        apiUserContent =
          `Le créateur a choisi cette évolution de l'aperçu : « ${text} ». ` +
          "Applique-la maintenant : émets le bloc APERCU en premier (un ou deux modules concernés), sans GENT_CONFIG ni recherche.";
      }
      history = nextDraft.builderConversation
        .filter((m) => m.role === "agent" || m.role === "user")
        .map((m) => ({
          role: m.role === "agent" ? "assistant" : "user",
          content: (m.text ?? "").replace(/<[^>]+>/g, ""),
        }));
      chatModelId = BUILDER_ASSISTANT_MODEL_ID;

      const builderConversation = [...nextDraft.builderConversation, userMsg, agentPlaceholder];
      // Premier message = objectif : on le range aussi dans le champ Objectif du
      // brouillon (accueil studio le fait déjà ; saisie directe dans l'assistant non).
      const objective =
        seedObjective && !(nextDraft.objective ?? "").trim() ? text.trim().slice(0, 240) : nextDraft.objective;
      return { ...prev, [id]: { ...nextDraft, objective, builderConversation } };
    });

    setIsThinking(true);
    setThinkingStatus(defaultStatusLabel("preparing"));

    const controller = new AbortController();
    streamAbortRef.current = controller;

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

    let lastLiveKey = "";
    function applyLivePreview(raw: string) {
      const live = extractAppPreviewSignal(raw);
      if (!live.preview) return;
      const incoming = live.preview;
      const key = incoming.modules.map((m) => `${m.id}:${m.blocks.length}`).join("|");
      if (key === lastLiveKey) return;
      lastLiveKey = key;
      const replace = live.replace;
      setDrafts((p) => {
        const d = p[id];
        return {
          ...p,
          [id]: {
            ...d,
            appPreview: mergeAppPreview(d.appPreview, incoming, replace),
            appPreviewFreshIds: incoming.modules.map((m) => m.id),
          },
        };
      });
    }

    streamChatCompletion(
      {
        model: chatModelId,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: apiUserContent }],
        // Les réponses du builder embarquent souvent un prompt système complet
        // + un bloc GENT_CONFIG : un plafond trop bas tronquait les propositions.
        // L'aperçu est un JSON court : un plafond plus bas évite que le modèle
        // parte dans une dissertation et n'atteigne jamais le bloc.
        max_tokens: askTurn
          ? CHAT_MAX_TOKENS.apercuAsk
          : previewTurn
            ? CHAT_MAX_TOKENS.apercu
            : CHAT_MAX_TOKENS.builder,
        ...(previewTurn || askTurn || !supportsReasoningStream(chatModelId) ? {} : { reasoning: { enabled: true } }),
        // Recherche web : utile pour découvrir des connecteurs. Pour l'aperçu
        // (données simulées), elle fait tourner le modèle à vide pendant
        // des minutes sans jamais émettre le bloc APERCU.
        webSearch: !previewTurn && !askTurn,
      },
      (fullSoFar, reasoningSoFar) => {
        let displayRaw = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
        if (askTurn) displayRaw = stripVisibleChoiceList(displayRaw);
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(displayRaw), reasoning: reasoningSoFar || undefined }));
        if (previewTurn) applyLivePreview(fullSoFar);
      },
      undefined,
      (status) => setThinkingStatus(status.label),
      "/api/chat",
      controller.signal
    )
      .then(({ text: fullRaw, truncated, reasoning }) => {
        const afterQuestions = extractQuestions(fullRaw);
        let questions = afterQuestions.questions;
        const afterConfig = extractGentConfigSignal(afterQuestions.text);
        const afterPreview = extractAppPreviewSignal(afterConfig.text);
        const afterSuggestions = extractConnectorSuggestions(afterPreview.text);
        const afterConnector = extractConnectorSignal(afterSuggestions.text);
        const afterJumpForm = extractJumpFormSignal(afterConnector.text);
        let reply = afterJumpForm.text;
        if (askTurn && !questions.length) {
          const recovered = recoverQuestionsFromChoiceList(reply);
          reply = recovered.text;
          questions = recovered.questions;
        } else if (questions.length) {
          reply = stripVisibleChoiceList(reply, questions.flatMap((q) => q.options));
        }
        const truncationNote = truncated
          ? '<p>⚠️ <em>Réponse tronquée (limite de longueur atteinte) — demandez « continue » ou reformulez plus court ; une proposition de configuration incomplète ne doit pas être appliquée.</em></p>'
          : "";
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(reply) + truncationNote, questions, reasoning: reasoning || undefined }));

        // Configuration complète proposée : carte « Appliquer la configuration ».
        // Un tour « aperçu » ne doit pas aussi reconfigurer le gent.
        if (afterConfig.config && !previewTurn && !askTurn) {
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

        // Aperçu d'application : appliqué immédiatement (c'est une maquette à
        // données simulées, rien de destructif à valider) pour que l'onglet
        // Aperçu se dessine sous les yeux du créateur au fil de l'échange.
        if (afterPreview.preview && !askTurn) {
          const incoming = afterPreview.preview;
          const replace = afterPreview.replace;
          setDrafts((p) => {
            const d = p[id];
            return {
              ...p,
              [id]: {
                ...d,
                appPreview: mergeAppPreview(d.appPreview, incoming, replace),
                appPreviewFreshIds: incoming.modules.map((m) => m.id),
              },
            };
          });
        }

        // Formulaire jump proposé : carte « Ajouter ce formulaire ».
        if (afterJumpForm.form && !previewTurn && !askTurn) {
          const form = afterJumpForm.form;
          setDrafts((p) => {
            const d = p[id];
            const msg = {
              id: `jumpform-${Date.now()}`,
              role: "jump-form-proposal" as const,
              jumpFormProposal: form,
              jumpFormProposalStatus: "pending" as const,
              t: "à l'instant",
            };
            return { ...p, [id]: { ...d, builderConversation: [...d.builderConversation, msg] } };
          });
        }

        // Connecteurs candidats découverts par recherche web : liste de
        // sélection à valider par le créateur. Ignorée si une configuration
        // complète a été proposée dans le même message (elle prime).
        const suggestions =
          afterConfig.config || previewTurn || askTurn
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
        if (afterConfig.config || previewTurn || askTurn) proposal = null;
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
        if (err?.name === "AbortError") {
          updateLastMessage((m) => ({
            ...m,
            text: (m.text?.trim() ? m.text : "") + "<p><em>Génération interrompue.</em></p>",
          }));
          return;
        }
        updateLastMessage(() => ({
          role: "agent" as const,
          text: `<p>Erreur de connexion au service IA${err?.message ? ` : ${err.message}` : ""}.</p>`,
          t: "à l'instant",
        }));
      })
      .finally(() => {
        if (streamAbortRef.current === controller) streamAbortRef.current = null;
        setIsThinking(false);
        setThinkingStatus(null);
      });
  }, []);

  // Le créateur a décrit le rôle de son gent sur l'accueil du studio : cette
  // description est rejouée ici, une seule fois, pour que l'assistant reprenne
  // l'échange au lieu de redemander ce qui vient d'être écrit. On attend
  // l'hydratation du stockage, sinon on jouerait le gabarit vierge — la
  // description ne vit que dans le cache local à cet instant.
  const seededDraftsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!storageReady) return;
    const pending = drafts[currentId]?.pendingBuilderMessage?.trim();
    if (!pending || seededDraftsRef.current.has(currentId)) return;
    seededDraftsRef.current.add(currentId);
    clearStoredPendingBuilderMessage(currentId);
    setDrafts((prev) => ({ ...prev, [currentId]: { ...prev[currentId], pendingBuilderMessage: undefined } }));
    sendBuilderMessage(pending);
  }, [drafts, currentId, storageReady, sendBuilderMessage]);

  const startNewBuilderConversation = useCallback(() => {
    streamAbortRef.current?.abort();
    const id = currentIdRef.current;
    setDrafts((prev) => {
      const draft = prev[id];
      if (!draft.builderConversation.length) return prev;
      return {
        ...prev,
        [id]: { ...draft, builderConversation: [], updatedAt: "à l'instant" },
      };
    });
    setIsThinking(false);
    setThinkingStatus(null);
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
          // Upsert par capacité : un .map seul n'ajoutait rien si la ligne
          // manquait, et un id mal classé (reasoning dans chat) restait invisible
          // dans les filtres Conversation du configurateur Prompt.
          const upsert = (
            list: typeof next.modelAssignments,
            capability: "chat" | "reasoning",
            modelId: string
          ) => {
            let found = false;
            const mapped = list.map((a) => {
              if (a.capability !== capability) return a;
              found = true;
              return { ...a, modelId };
            });
            return found ? mapped : [...mapped, { capability, modelId }];
          };
          let assignments = next.modelAssignments;
          if (cfg.chatModelId) assignments = upsert(assignments, "chat", cfg.chatModelId);
          if (cfg.reasoningModelId) assignments = upsert(assignments, "reasoning", cfg.reasoningModelId);
          next.modelAssignments = assignments;
        }
        if (cfg.connectors?.length) {
          // Met à jour un connecteur existant (même URL) au lieu de l'ignorer :
          // c'est ainsi que les corrections de config de l'assistant (ex.
          // déplacer app_id en paramètre fixe) prennent réellement effet.
          const connectors = [...next.connectors];
          cfg.connectors.forEach((c, i) => {
            const isRest = c.kind === "api-rest" && !!c.restConfig;
            const identity = isRest ? c.restConfig!.baseUrl : c.url;
            const existingIdx = connectors.findIndex((ec) =>
              isRest
                ? ec.toolKind === "api-rest" && ec.restConfig?.baseUrl === identity
                : (ec.restConfig?.baseUrl ?? ec.detail) === identity
            );
            if (existingIdx >= 0) {
              const mergedRest =
                isRest && c.restConfig
                  ? mergeRestConfigSecrets(c.restConfig, connectors[existingIdx].restConfig)
                  : connectors[existingIdx].restConfig;
              connectors[existingIdx] = {
                ...connectors[existingIdx],
                toolKind: c.kind,
                name: c.name,
                detail: mergedRest ? `${mergedRest.method} ${mergedRest.baseUrl}` : c.url,
                restConfig: mergedRest,
              };
            } else if (isRest && c.restConfig) {
              connectors.push({
                id: `tool-${Date.now()}-${i}`,
                toolKind: c.kind,
                name: c.name,
                detail: `${c.restConfig.method} ${c.restConfig.baseUrl}`,
                restConfig: c.restConfig,
              });
            } else {
              connectors.push({ id: `tool-${Date.now()}-${i}`, toolKind: c.kind, name: c.name, detail: c.url });
            }
          });
          next.connectors = connectors;
        }
        if (cfg.pinnedArtefact) {
          const base = next.pinnedArtefact ?? { enabled: false, title: "", mission: "", inputs: [] };
          next.pinnedArtefact = { ...base, ...cfg.pinnedArtefact };
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

  // Applique (ou ignore) un formulaire jump proposé par l'assistant.
  const applyJumpForm = useCallback((messageId: string, decision: "apply" | "dismiss") => {
    setDrafts((prev) => {
      const draft = prev[currentId];
      const msg = draft.builderConversation.find((m) => m.id === messageId);
      const form: JumpForm | undefined = msg?.jumpFormProposal;
      if (!form) return prev;
      const builderConversation = draft.builderConversation.map((m) =>
        m.id === messageId
          ? { ...m, jumpFormProposalStatus: decision === "apply" ? ("applied" as const) : ("dismissed" as const) }
          : m
      );
      return {
        ...prev,
        [currentId]: {
          ...draft,
          jumpForm: decision === "apply" ? form : draft.jumpForm,
          builderConversation,
          updatedAt: "à l'instant",
        },
      };
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
        assistantCollapsed,
        switchDraft,
        switchTab,
        toggleRail,
        toggleAssistant,
        createDraft,
        updateObjective,
        updateSystemPrompt,
        updateName,
        updateIcon,
        publishDraft,
        syncWorkingVersion,
        assignModel,
        addKnowledgeSource,
        removeKnowledgeSource,
        addToolInstance,
        renameToolInstance,
        updateToolInstance,
        removeToolInstance,
        toggleWebSearch,
        updateFileDownload,
        updateRoutine,
        updateChannel,
        updatePinnedArtefact,
        updateVisionneuse,
        clearAppPreview,
        sendBuilderMessage,
        startNewBuilderConversation,
        applyBuilderSuggestion,
        confirmConnectorProposal,
        confirmConnectorSuggestions,
        applyGentConfig,
        applyJumpForm,
        isThinking,
        thinkingStatus,
        stopGeneration,
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
