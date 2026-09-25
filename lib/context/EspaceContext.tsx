"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type {
  Espace,
  EspacesMap,
  ReservationItem,
  ConversationThread,
  ConversationMessage,
  Artefact,
  ArtefactProposal,
  ThemeTab,
  ThemeTabProposalAction,
  PendingArtefactVerdict,
  PinnedRun,
  UserFile,
  DocumentViewerSpec,
} from "@/lib/types";
import { ESPACES as INITIAL_ESPACES } from "@/lib/mock-data/espaces";
import {
  formatConversationStartedAt,
  getActiveConversation,
  newConversationId,
} from "@/lib/conversationUtils";
import { extractQuestions, extractFollowups, recoverQuestionsFromChoiceList } from "@/lib/suggestions";
import { extractEtatJeu } from "@/lib/jeuEtat";
import {
  extractArtefactSignal,
  extractArtefactPossible,
  artefactEnCoursDEcriture,
  MESSAGE_EN_ARTEFACT,
} from "@/lib/artefactSignal";
import {
  artefactHomonyme,
  avecContexteEspace,
  avecPreferenceArtefact,
  historiquePourModele,
  preferenceArtefact,
} from "@/lib/historiqueModele";
import { contexteArtefacts, resoudreRetouche } from "@/lib/operationsBlocs";
import { avecNouvelleVersion, restaurerVersion } from "@/lib/versionsArtefact";
import { lireMessageOnglet, PREFIXE_ONGLET } from "@/lib/ongletArtefact";
import { mesurerArtefact } from "@/lib/telemetrieArtefact";
import { formeDeduite } from "@/lib/dashboardArtefact";
import {
  appliquerMemoireVisiteur,
  cleMemoireVisiteur,
  extraireMemoireVisiteur,
  lireMemoireVisiteur,
} from "@/lib/memoireVisiteur";
import { ARTEFACT_KIND_META, type WorkspaceArtefactKind } from "@/lib/artefactKind";
import { convertArtefactToKind } from "@/lib/artefactConversion";
import {
  extractThemeTabSignal,
  themeActionWithArtefact,
  upsertArtefactThemeTab,
} from "@/lib/themeTabSignal";
import { extractGeolocRequest } from "@/lib/geolocSignal";
import { extractProfileSignal } from "@/lib/profileSignal";
import { extractImageSignal, IMAGES_THEME_LABEL, type ImageProposal } from "@/lib/imageSignal";
import { resolveImageModelId } from "@/lib/imageModels";
import { materializeProfileMedia } from "@/lib/profileSummaryArtefact";
import { readPublishedGents, writePublishedGent, syncPublishedGentsFromRemote } from "@/lib/publishedGents";
import { langueDeLEnTete } from "@/lib/langue";
import { modeleConversationEffectif } from "@/lib/modeleConversation";
import {
  estCoupureReseau,
  estReponseVide,
  messageErreurTraitement,
  MESSAGE_CONNEXION_COUPEE,
  MESSAGE_REPONSE_VIDE,
} from "@/lib/reponseVide";
import {
  espaceForPinnedRefresh,
  espaceForStarters,
  formatApiNetworkError,
} from "@/lib/espaceApiPayload";
import { renderMarkdown } from "@/lib/markdown";
import { streamChatCompletion, CHAT_MAX_TOKENS, defaultStatusLabel, humanToolCallLabel } from "@/lib/streamChat";
import { supportsReasoningStream } from "@/lib/openRouterReasoning";
import { buildJumpFormPrompt } from "@/lib/jumpFormSignal";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";

/**
 * L'artefact qu'une proposition REMPLACE : celui qu'une retouche vise par son
 * identifiant, sinon celui qui porte le même titre (version complète).
 */
function cibleDuRemplacement(artefacts: Artefact[], proposition: ArtefactProposal): Artefact | undefined {
  if (proposition.modification) {
    return artefacts.find((a) => a.id === proposition.modification!.artefactId);
  }
  return artefactHomonyme(artefacts, proposition.title);
}

function artefactFromProposal(sig: ArtefactProposal, id: string): Artefact {
  const meta = ARTEFACT_KIND_META[sig.kind] ?? { type: "Artefact", icon: "📄" };
  const profileSummary = sig.profileSummary
    ? { ...sig.profileSummary, media: materializeProfileMedia(sig.profileSummary.media) }
    : undefined;
  return {
    id,
    title: sig.title,
    // Artefact à blocs : son type se DÉDUIT de sa composition (« Frise »,
    // « Checklist »…) au lieu d'afficher « Tableau de bord » pour tout.
    type: sig.dashboard ? formeDeduite(sig.dashboard) : meta.type,
    icon: meta.icon,
    kind: sig.kind,
    date: "à l'instant",
    body: sig.body ? renderMarkdown(sig.body) : undefined,
    chartData: sig.chartData,
    checklistItems: sig.items?.map((label) => ({ label, checked: false })),
    mapPoints: sig.mapPoints,
    dashboard: sig.dashboard,
    profileSummary,
  };
}

/** Ajoute le module à la rubrique « Images » (créée si besoin). */
function upsertImagesThemeTab(themeTabs: ThemeTab[], moduleId: string): ThemeTab[] {
  const existing = themeTabs.find((t) => t.label === IMAGES_THEME_LABEL);
  if (existing) {
    if (existing.moduleIds.includes(moduleId)) return themeTabs;
    return themeTabs.map((t) =>
      t.id === existing.id ? { ...t, moduleIds: [...t.moduleIds, moduleId] } : t
    );
  }
  return [...themeTabs, { id: `theme-images-${Date.now()}`, label: IMAGES_THEME_LABEL, moduleIds: [moduleId] }];
}

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

/** Jour et heure : un historique de versions s'étale sur plusieurs jours. */
function horodatage(): string {
  return new Date().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  /**
   * Artefact tout juste généré, affiché en popup avant d'être ajouté à
   * l'espace — null tant qu'aucun verdict (Garder / Jeter) n'est en attente.
   */
  pendingArtefactVerdict: PendingArtefactVerdict | null;
  /**
   * Une coquille dote-t-elle l'ecran d'un VOLET capable d'accueillir un
   * artefact en attente de verdict ? Si oui, la fenetre plein ecran ne
   * s'ouvre pas pour lui — c'est le volet qui l'affiche et porte la decision.
   * Faux par defaut : un ecran sans volet garde l'ancien chemin.
   */
  verdictEnVolet: boolean;
  declarerVoletVerdict: (present: boolean) => void;
  /**
   * Emplacement PROPRE à la visionneuse, distinct de `modalArtefactId` : les
   * deux doivent pouvoir coexister. Un artefact ouvert depuis la conversation
   * pendant la lecture se superpose à la visionneuse au lieu de la remplacer —
   * le lecteur ne perd jamais sa page.
   */
  viewerArtefactId: string | null;
  documentViewerOpen: boolean;
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
  /** Ferme la visionneuse sans toucher à un éventuel artefact ouvert par-dessus. */
  closeDocumentViewer: () => void;
  updateMemory: (text: string) => void;
  sendMessage: (text: string) => void;
  /** « En faire un artefact » : demande l'artefact que le gent a jugé possible. */
  demanderArtefact: () => void;
  /** Envoie une demande composée à partir d'un formulaire jump (voir jumpFormSignal). */
  submitJumpForm: (values: Record<string, string>) => void;
  /** Déploie la conversation et envoie la question d'amorce cliquée. */
  runStarter: (question: string) => void;
  /** Génère les déclencheurs si l'espace est encore vierge (appel unique). */
  ensureStarters: () => void;
  /**
   * Vrai une fois l'hydratation terminée (cache local + synchronisation
   * serveur). Toute écriture d'espace faite avant serait écrasée par la
   * synchronisation qui se termine ensuite.
   */
  storageReady: boolean;
  isThinking: boolean;
  /** Libellé de la phase en cours (réflexion, outil, rédaction…). */
  thinkingStatus: string | null;
  /** Le modèle écrit un bloc d'artefact, après le texte visible. */
  artefactEnPreparation: boolean;
  /** Interrompt la génération en cours (bouton Stop du composer). */
  stopGeneration: () => void;
  /** Position partagée par l'utilisateur (consentement explicite) — null sinon. */
  userPosition: { lat: number; lon: number } | null;
  geoStatus: GeoStatus;
  requestGeolocation: () => void;
  /** Réponse de l'utilisateur à une demande de position émise par le gent dans le fil. */
  confirmGeoRequest: (messageId: string, decision: "share" | "deny") => void;
  removeArtefact: (artefactId: string) => void;
  /** Change le type d'un artefact gardé et le range dans l'onglet thématique correspondant. */
  changeArtefactKind: (artefactId: string, kind: WorkspaceArtefactKind) => void;
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
  /**
   * Autorise ou refuse une illustration proposée (génération IA ou photo web).
   * La génération / l'ajout à la rubrique Images n'ont lieu qu'après « generate ».
   */
  confirmImageProposal: (messageId: string, decision: "generate" | "dismiss") => void;
  /** Autorise la génération d'un média en attente dans un résumé de profil. */
  generateProfileSummaryMedia: (artefactId: string, mediaId: string) => void;
  /** Valide ou ignore le profil utilisateur proposé par le gent. */
  confirmProfileProposal: (proposalId: string, decision: "apply" | "dismiss") => void;
  toggleChecklistItem: (artefactId: string, itemIndex: number) => void;
  /** Coche une case d'un bloc checklist, dans un artefact à blocs. */
  toggleBlocChecklist: (artefactId: string, blocId: string, itemIndex: number) => void;
  /** Revient à une version antérieure d'un artefact — en rangeant l'actuelle. */
  restaurerVersionArtefact: (artefactId: string, n: number) => void;
  /** Remplace un artefact modifié à la main ; `resume` présent = nouvelle version. */
  modifierArtefact: (artefactId: string, apres: Artefact, resume?: string) => void;
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
  /**
   * Mode JEU : le gent est piloté par un moteur déterministe (`moteurJeu`).
   * Comme en mini-application, la partie se joue sur la zone principale et le
   * panneau conversationnel n'est ni rendu ni rappelable — une décision
   * présidentielle dans une colonne de discussion n'est plus une décision.
   * Le fil reste la SAUVEGARDE de la partie : on le cache, on ne le supprime pas.
   */
  modeJeu: boolean;
  /** Ajoute un document à la session (texte déjà extrait côté navigateur). */
  addFile: (file: UserFile) => void;
  removeFile: (fileId: string) => void;
  /** Ouvre un document en visionneuse pleine page (sommaire + pagination). */
  addDocumentArtefact: (spec: DocumentViewerSpec) => void;
}

const EspaceContext = createContext<EspaceContextValue | null>(null);

export function EspaceProvider({
  children,
  initialId,
  shareToken,
  apercu = false,
  initialEspaces,
  assistantOuvertAuDepart = false,
}: {
  children: ReactNode;
  initialId: string;
  /**
   * La conversation est-elle ouverte DES LE PREMIER RENDU ?
   *
   * L'ouvrir dans un effet apres le montage produisait un saut visible : la
   * page s'affichait une image sur l'espace du gent, puis basculait sur la
   * conversation. Une valeur initiale ne saute pas — il n'y a rien a corriger
   * apres coup.
   */
  assistantOuvertAuDepart?: boolean;
  /**
   * Mode « lien de partage » : l'espace est fourni par le serveur (projection
   * publique), le localStorage et la synchro Supabase sont désactivés, et les
   * appels chat/refresh passent par les routes tokenisées.
   */
  shareToken?: string;
  /**
   * Aperçu du créateur (`/apercu/<id>`) : l'écran et la consigne du VISITEUR,
   * sur la version de travail fournie par `initialEspaces`. Rien n'est relu
   * ni réécrit — surtout pas la version de travail, qu'un fil d'essai
   * écraserait. Les appels passent par les routes du créateur : cette version
   * n'est pas encore en base, aucun lien ne pourrait la relire.
   */
  apercu?: boolean;
  initialEspaces?: EspacesMap;
}) {
  // `shareMode` dit à l'INTERFACE qu'elle s'adresse à un visiteur ; les routes,
  // elles, se choisissent sur `shareToken`.
  const shareMode = !!shareToken || apercu;
  const [espaces, setEspaces] = useState<EspacesMap>(() => initialEspaces ?? seedEspaces(initialId));
  // L'espace tel que le serveur l'a servi : ce qui s'y trouve appartient au
  // créateur, tout ajout ultérieur au visiteur (voir lib/memoireVisiteur).
  const diffuseRef = useRef<Espace | undefined>(initialEspaces?.[initialId]);
  const [currentId, setCurrentId] = useState(initialId);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(0);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(assistantOuvertAuDepart);
  const [asideCollapsed, setAsideCollapsed] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [modalArtefactId, setModalArtefactId] = useState<string | null>(null);
  const [modalResvId, setModalResvId] = useState<string | null>(null);
  const [pendingArtefactVerdict, setPendingArtefactVerdict] = useState<PendingArtefactVerdict | null>(null);
  /**
   * Le modèle écrit un bloc d'artefact. Le texte visible est alors terminé —
   * l'affichage s'arrête au premier `<!--` — et, sans ce signal, rien ne dit à
   * l'utilisateur que quelque chose se prépare encore pendant les secondes que
   * prend un tableau de bord.
   */
  const [artefactEnPreparation, setArtefactEnPreparation] = useState(false);
  const [verdictEnVolet, setVerdictEnVolet] = useState(false);
  const declarerVoletVerdict = useCallback((present: boolean) => setVerdictEnVolet(present), []);
  const [viewerArtefactId, setViewerArtefactId] = useState<string | null>(null);
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
  // Un seul appel de génération des déclencheurs par gent et par session, même
  // si l'espace se remonte plusieurs fois (changement d'onglet, re-render).
  const startersRequestedRef = useRef<Set<string>>(new Set());
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
    // Lien de partage : le destinataire n'a pas accès aux routes /api/gents —
    // l'espace reçu du serveur fait foi. Seule SA part (conversations,
    // artefacts gardés) est relue depuis son navigateur : sans elle, un
    // rechargement effaçait tout ce qu'il avait « gardé dans l'espace ».
    if (shareMode) {
      const diffuse = diffuseRef.current;
      if (diffuse && shareToken) {
        let memoire = null;
        try {
          memoire = lireMemoireVisiteur(window.localStorage.getItem(cleMemoireVisiteur(shareToken)));
        } catch {
          // Stockage refusé (navigation privée stricte) : on repart du fil vierge.
        }
        if (memoire) {
          const restaure = appliquerMemoireVisiteur(diffuse, memoire);
          setEspaces((prev) => ({ ...prev, [initialId]: restaure }));
        }
      }
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
        if (merged && merged !== "unauthorized" && Object.keys(merged).length) {
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

  // Lien de partage : la part du visiteur est réécrite dans SON navigateur.
  // Regroupée : pendant une réponse, l'espace change à chaque jeton, et
  // resérialiser toute la conversation à ce rythme ferait ramer la page.
  useEffect(() => {
    if (!storageReady || !shareMode || !shareToken) return;
    const diffuse = diffuseRef.current;
    const espace = espaces[initialId];
    if (!diffuse || !espace) return;
    const minuterie = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          cleMemoireVisiteur(shareToken),
          JSON.stringify(extraireMemoireVisiteur(espace, diffuse))
        );
      } catch (err) {
        // Quota dépassé (images volumineuses) ou stockage interdit : la
        // session continue, seul le rechargement perdra l'état.
        console.warn("[getgents:visiteur] mémoire non enregistrée", (err as Error)?.name);
      }
    }, 800);
    return () => window.clearTimeout(minuterie);
  }, [espaces, initialId, storageReady, shareMode, shareToken]);

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

  /**
   * Génère les déclencheurs à la première ouverture d'un espace encore vierge,
   * puis les persiste : c'est un appel unique par gent, pas à chaque visite.
   * Silencieux en cas d'échec — l'espace retombe sur son état vide d'origine.
   */
  const ensureStarters = useCallback(async () => {
    const id = currentIdRef.current;
    const espace = espacesRef.current[id];
    if (!espace || espace.pinnedArtefact?.enabled) return;
    if (espace.starters?.length) return;
    if (startersRequestedRef.current.has(id)) return;
    startersRequestedRef.current.add(id);

    try {
      // Par le lien : le serveur relit la version diffusée et met le résultat
      // en cache dessus, donc un seul appel au modèle par gent quel que soit
      // le nombre de visiteurs. Le créateur, lui, envoie sa configuration
      // courante — elle n'est pas encore en base tant qu'il n'a pas diffusé.
      const res = shareToken
        ? await fetch(`/api/links/${encodeURIComponent(shareToken)}/starters`, { method: "POST" })
        : await fetch("/api/starters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ espace: espaceForStarters(espace) }),
          });
      if (!res.ok) return;
      const data = (await res.json()) as { starters?: string[] };
      if (!data.starters?.length) return;
      setEspaces((prev) => {
        const e = prev[id];
        if (!e) return prev;
        return { ...prev, [id]: { ...e, starters: data.starters, startersGeneratedAt: new Date().toISOString() } };
      });
    } catch {
      // Réseau indisponible : pas de déclencheurs, l'espace reste utilisable.
    }
  }, [shareToken]);

  const toggleAsideCollapsed = useCallback(() => setAsideCollapsed((v) => !v), []);

  const selectDay = useCallback((day: number | null) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  }, []);

  // Un artefact « document » va dans l'emplacement visionneuse, les autres
  // dans la carte modale classique : c'est ce qui permet d'ouvrir un rapport
  // généré en cours de lecture SANS fermer le document qu'on est en train de
  // lire (l'artefact se superpose, la visionneuse reste dessous).
  const openArtefactModal = useCallback((id: string) => {
    const espace = espacesRef.current[currentIdRef.current];
    if (espace?.artefacts.find((a) => a.id === id)?.document) {
      setViewerArtefactId(id);
      return;
    }
    setModalArtefactId(id);
    setModalResvId(null);
  }, []);

  const closeDocumentViewer = useCallback(() => setViewerArtefactId(null), []);

  const openResvModal = useCallback((id: string) => {
    setModalResvId(id);
    setModalArtefactId(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalArtefactId(null);
    setModalResvId(null);
  }, []);

  // Type « visionneuse » : l'espace s'ouvre directement sur le document fixé
  // par le créateur, une fois par visite — pas un chat vide qu'il faudrait
  // penser à quitter pour lire, ni un choix entre les deux.
  const visionneuseAutoOpenedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentEspace?.visionneuse?.enabled) return;
    if (visionneuseAutoOpenedRef.current.has(currentId)) return;
    const hasDoc = currentEspace.artefacts.some((a) => a.id === "visionneuse-doc");
    if (!hasDoc) return;
    visionneuseAutoOpenedRef.current.add(currentId);
    setViewerArtefactId("visionneuse-doc");
  }, [currentEspace, currentId]);

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

  /**
   * Ouvre un document en visionneuse pleine page. Contrairement aux autres
   * artefacts, celui-ci n'est jamais proposé par le modèle (son contenu peut
   * atteindre des centaines de milliers de caractères, hors de portée d'un
   * bloc de signal) : le créateur — ou l'utilisateur — le dépose directement
   * depuis le composer, et l'artefact est créé côté client, immédiatement.
   *
   * Le texte rejoint aussi `files` (borné par sessionContextNote) pour que
   * l'assistant puisse en discuter et proposer d'autres artefacts à l'appui
   * de la lecture — mêmes règles que n'importe quel document joint.
   */
  const addDocumentArtefact = useCallback(
    (spec: DocumentViewerSpec) => {
      const id = currentIdRef.current;
      const artefactId = `doc-${Date.now()}`;
      const fileId = `file-${Date.now()}`;
      setEspaces((prev) => {
        const e = prev[id];
        const artefact = {
          id: artefactId,
          title: spec.sourceName,
          type: "Visionneuse de document",
          icon: "📖",
          date: nowTime(),
          document: spec,
        };
        const file = {
          id: fileId,
          name: spec.sourceName,
          size: `${spec.pageCount} page${spec.pageCount > 1 ? "s" : ""}`,
          date: "Visionneuse",
          text: spec.pages.join("\n\n"),
          truncated: spec.truncated,
        };
        return {
          ...prev,
          [id]: {
            ...e,
            artefacts: [...e.artefacts, artefact],
            files: [file, ...e.files.filter((f) => f.id !== fileId)],
          },
        };
      });
      // Emplacement visionneuse visé DIRECTEMENT : passer par
      // openArtefactModal relirait espacesRef, qui ne contient pas encore
      // l'artefact tout juste créé (la mise à jour d'état n'a pas eu lieu) —
      // le document s'ouvrait alors dans la carte modale générique, vide.
      setViewerArtefactId(artefactId);
    },
    []
  );

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
    const gmail = espace.gmail;
    const restApis = espace.restApis;
    const webSearch = espace.webSearch;
    // Moteur de jeu déterministe (ex. « Élysée 2027 ») : la route répondra
    // sans appeler de modèle — ni clé ni quota côté serveur.
    const moteurJeu = espace.moteurJeu;
    const thread = espace.conversations.find((t) => t.id === threadId);
    // Les propositions d'artefact et leur verdict y voyagent : sans elles, le
    // modèle reproposait ce qu'on venait de jeter (voir lib/historiqueModele).
    // Les artefacts gardés et leurs blocs accompagnent le message : c'est ce
    // qui permet au gent de RETOUCHER un bloc au lieu de tout régénérer.
    const filComplet = [...(thread?.messages ?? []), userMsg];
    const history = avecPreferenceArtefact(
      avecContexteEspace(historiquePourModele(filComplet), contexteArtefacts(espace.artefacts)),
      preferenceArtefact(filComplet)
    );

    // Assemblage partagé avec le chemin « lien de partage » : un même gent
    // doit se comporter à l'identique en Preview et chez un destinataire.
    // Aperçu : la consigne de l'INVITÉ, comme sur le lien — sans mémoire ni
    // documents de session, et amorcée par la langue du navigateur, comme la
    // route du lien l'est par l'en-tête Accept-Language.
    const systemPrompt = apercu
      ? buildGentSystemPrompt(espace, {
          variant: "sharedLink",
          position,
          langueNavigateur:
            typeof navigator !== "undefined" ? langueDeLEnTete((navigator.languages ?? []).join(",")) : null,
        })
      : buildGentSystemPrompt(espace, { variant: "espace", position });
    const chatModelId = modeleConversationEffectif(espace.chatModelId).id;

    setEspaces((prev) => {
      const e = prev[id];
      // Le fil actif peut ne pas exister encore : la projection publique d'un
      // lien de partage ne transmet aucune conversation (celles du créateur ne
      // regardent pas le destinataire) et n'annonce qu'un identifiant. Sans
      // cette création, tous les `map` sur conversations étaient des no-op :
      // ni la question ni la réponse n'étaient jamais stockées, et l'échange
      // restait muet.
      const base = e.conversations.some((t) => t.id === threadId)
        ? e.conversations
        : [...e.conversations, { id: threadId, startedAt: formatConversationStartedAt(), messages: [] }];
      const conversations = base.map((t) =>
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
        ...(supportsReasoningStream(chatModelId) ? { reasoning: { enabled: true } } : {}),
        mcpServers,
        datasets,
        prim,
        powens,
        gmail,
        gentId: id,
        restApis,
        webSearch,
        jeu: moteurJeu,
      },
      (fullSoFar, reasoningSoFar) => {
        const displayRaw = fullSoFar.includes("<!--") ? fullSoFar.slice(0, fullSoFar.indexOf("<!--")) : fullSoFar;
        updateLastMessage((m) => ({ ...m, text: renderMarkdown(displayRaw), reasoning: reasoningSoFar || undefined }));
        setArtefactEnPreparation(artefactEnCoursDEcriture(fullSoFar));
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
              : call.startsWith("gmail_")
                ? "Gmail"
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
        // État de partie d'un moteur de jeu (bloc ETAT_JEU) : retiré du texte
        // AVANT tout le reste, car c'est le seul bloc qui contient du JSON
        // imbriqué — le laisser traîner brouillerait les extracteurs suivants.
        const afterEtatJeu = extractEtatJeu(fullRaw);
        const jeuEtat = afterEtatJeu.etat ?? undefined;
        const extracted = extractQuestions(afterEtatJeu.text);
        // Repli : le modèle a posé une question et listé les choix en clair
        // (puces, numéros, lettres) sans bloc QUESTIONS. Sans ce repli,
        // l'utilisateur d'un gent « à choix » (jeu de rôle, QCM) se retrouve
        // sans boutons et doit recopier une option à la main.
        const afterQuestions = extracted.questions.length
          ? extracted
          : recoverQuestionsFromChoiceList(extracted.text, { requireQuestion: true });
        const afterFollowups = extractFollowups(afterQuestions.text);
        const afterArtefact = extractArtefactSignal(afterFollowups.text);
        // « Un artefact servirait ici » : bouton sous la réponse, sauf si un
        // artefact a été produit ou annoncé (échec) — il n'y a alors rien à proposer.
        const afterPossible = extractArtefactPossible(afterArtefact.text);
        const afterTheme = extractThemeTabSignal(afterPossible.text);
        const afterGeo = extractGeolocRequest(afterTheme.text);
        const afterProfile = extractProfileSignal(afterGeo.text);
        const afterImage = extractImageSignal(afterProfile.text);
        // Coupée PENDANT l'artefact : le texte, lui, est complet, et « écrivez
        // continue » ne rendrait pas l'artefact. C'est la carte d'échec, sous
        // la réponse, qui l'explique et propose de réessayer.
        // Une retouche se résout contre les artefacts gardés : elle devient la
        // proposition de leur nouvelle version, ou un échec « cible » annoncé.
        const signal = afterArtefact.artefact;
        let proposition: ArtefactProposal | null = signal;
        let artefactEchec = afterArtefact.echec;
        if (signal?.operations && signal.cible) {
          proposition = resoudreRetouche(espace.artefacts, signal.cible, signal.operations);
          if (!proposition) artefactEchec = "cible";
        }
        const contexteMesure = {
          mode: shareToken ? ("lien" as const) : ("espace" as const),
          modele: chatModelId,
          frequence: espace.frequenceArtefacts,
          gent: espace.gent,
        };
        if (proposition) {
          mesurerArtefact({ ...contexteMesure, evenement: "propose", forme: proposition.kind });
        } else if (artefactEchec) {
          mesurerArtefact({ ...contexteMesure, evenement: "perdu", echec: artefactEchec });
        }
        const finalHtml =
          renderMarkdown(afterImage.text) +
          (truncated && artefactEchec !== "tronque"
            ? '<p>⚠️ <em>Réponse tronquée (limite de longueur atteinte) — écrivez « continue » pour obtenir la suite, ou demandez une version plus courte.</em></p>'
            : "");
        const followups = afterFollowups.followups;

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

        if (proposition) {
          const sig = proposition;
          const proposalId = `prop-${Date.now()}`;
          const attachedTheme = afterTheme.themeAction ?? undefined;
          // Prévisualisation seulement : l'artefact n'entre dans l'espace qu'au Garder.
          const preview = artefactFromProposal(sig, `pending-${proposalId}`);
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
                  jeuEtat,
                  followups,
                  reasoning: reasoning || undefined,
                };
              msgs.push({
                id: proposalId,
                role: "artef-proposal" as const,
                proposal: sig,
                proposalStatus: "pending" as const,
                themeProposal: attachedTheme,
                themeProposalStatus: attachedTheme ? ("pending" as const) : undefined,
                t: nowTime(),
              });
              return { ...t, messages: msgs };
            });
            return { ...p, [id]: { ...e, conversations: convs } };
          });
          setModalArtefactId(null);
          setModalResvId(null);
          setPendingArtefactVerdict({ proposalMessageId: proposalId, preview, modification: sig.modification });
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
                  jeuEtat,
                  followups,
                  reasoning: reasoning || undefined,
                  artefactEchec,
                  artefactPossible: afterPossible.possible && !proposition && !artefactEchec,
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
          // Rien à montrer — ni texte, ni artefact, ni carte : sans ce
          // repli, la bulle restait vide et le visiteur ne savait pas si le
          // gent réfléchissait encore.
          const muet =
            estReponseVide(finalHtml) &&
            !artefactEchec &&
            !afterQuestions.questions.length &&
            !jeuEtat &&
            !afterGeo.geoRequest &&
            !afterProfile.profile &&
            !afterImage.image;
          updateLastMessage((m) => ({
            ...m,
            text: muet ? MESSAGE_REPONSE_VIDE : finalHtml,
            questions: afterQuestions.questions,
            jeuEtat,
            followups,
            reasoning: reasoning || undefined,
            artefactEchec,
            artefactPossible: afterPossible.possible && !proposition && !artefactEchec,
          }));
        }
        // Illustration proposée : carte d'autorisation dans le fil — jamais
        // de génération ni d'affichage sans accord explicite (coût modèle).
        function pushImageProposalIfAny() {
          const proposal = afterImage.image;
          if (!proposal) return;
          // Les propositions generate restent affichées même sans modèle
          // assigné : à l'autorisation on retombe sur Nanobanana (défaut).
          const imgMsgId = `img-${Date.now()}`;
          setEspaces((p) => {
            const e = p[id];
            const convs = e.conversations.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    messages: [
                      ...t.messages,
                      {
                        id: imgMsgId,
                        role: "image-proposal" as const,
                        imageProposal: proposal,
                        imageProposalStatus: "pending" as const,
                        t: nowTime(),
                      },
                    ],
                  }
                : t
            );
            return { ...p, [id]: { ...e, conversations: convs } };
          });
        }

        pushGeoRequestIfAny();
        pushProfileProposalIfAny();
        pushImageProposalIfAny();
      })
      .catch((err: Error) => {
        // Toute erreur finit ici — y compris un BUG du traitement de la
        // réponse, qui ressemblait alors à une coupure réseau. La console
        // garde la vraie cause.
        console.error("[getgents:chat] réponse non traitée", err);
        if (err?.name === "AbortError") {
          updateLastMessage((m) => ({
            ...m,
            text: (m.text?.trim()
              ? m.text
              : "") + '<p><em>Génération interrompue.</em></p>',
          }));
          return;
        }
        if (estCoupureReseau(err)) {
          updateLastMessage((m) => ({
            ...m,
            role: "agent" as const,
            text: (estReponseVide(m.text) ? "" : m.text) + MESSAGE_CONNEXION_COUPEE,
            t: m.t ?? nowTime(),
          }));
          return;
        }
        if (err instanceof TypeError) {
          // Un bug de traitement, pas le réseau : le texte reçu reste, suivi de
          // la vraie cause.
          updateLastMessage((m) => ({
            ...m,
            role: "agent" as const,
            text: (estReponseVide(m.text) ? "" : m.text) + messageErreurTraitement(err),
            t: m.t ?? nowTime(),
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
        setArtefactEnPreparation(false);
      });
  }, [shareToken]);

  /** Bouton « En faire un artefact » : un message visible, et une mesure. */
  const demanderArtefact = useCallback(() => {
    const e = espacesRef.current[currentIdRef.current];
    mesurerArtefact({
      evenement: "demande",
      mode: shareToken ? "lien" : "espace",
      modele: e?.chatModelId,
      frequence: e?.frequenceArtefacts,
      gent: e?.gent,
    });
    sendMessage(MESSAGE_EN_ARTEFACT);
  }, [sendMessage, shareToken]);

  /**
   * Clic sur un déclencheur : la conversation se déploie et la question part
   * aussitôt — l'utilisateur voit le gent répondre sans avoir eu à rédiger.
   */
  const runStarter = useCallback(
    (question: string) => {
      openAssistant();
      sendMessage(question);
    },
    [openAssistant, sendMessage]
  );

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
      const newArtefactId = `artef-${Date.now()}`;
      const newArtefact = artefactFromProposal(targetMsg.proposal, newArtefactId);

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

  /**
   * Ajoute une illustration autorisée à l'espace (artefact + rubrique Images)
   * et met à jour le message de proposition.
   */
  function commitImageArtefact(
    messageId: string,
    proposal: ImageProposal,
    imageUrl: string,
    source: "generated" | "web"
  ) {
    const id = currentIdRef.current;
    const artefactId = `artef-${Date.now()}`;
    const moduleId = `artef-${artefactId}`;
    const meta = ARTEFACT_KIND_META.image;
    const newArtefact: Artefact = {
      id: artefactId,
      title: proposal.title,
      type: meta.type,
      icon: meta.icon,
      date: "à l'instant",
      imageUrl,
      kind: "image",
      imageCaption: proposal.caption,
      imageSource: source,
      body: proposal.caption ? `<p>${proposal.caption.replace(/</g, "&lt;")}</p>` : undefined,
    };

    setEspaces((prev) => {
      const espace = prev[id];
      const conversations = espace.conversations.map((t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                imageProposalStatus: "added" as const,
                imageUrl,
                imageStatus: "done" as const,
                ref: artefactId,
              }
            : m
        ),
      }));
      return {
        ...prev,
        [id]: {
          ...espace,
          artefacts: [newArtefact, ...espace.artefacts],
          themeTabs: upsertImagesThemeTab(espace.themeTabs ?? [], moduleId),
          conversations,
        },
      };
    });
  }

  const confirmImageProposal = useCallback((messageId: string, decision: "generate" | "dismiss") => {
    const id = currentIdRef.current;
    const espace = espacesRef.current[id];
    if (!espace) return;
    let proposal: ImageProposal | undefined;
    for (const t of espace.conversations) {
      const found = t.messages.find((m) => m.id === messageId);
      if (found?.imageProposal) {
        proposal = found.imageProposal;
        break;
      }
    }
    if (!proposal) return;

    if (decision === "dismiss") {
      setEspaces((prev) => {
        const e = prev[id];
        return {
          ...prev,
          [id]: {
            ...e,
            conversations: e.conversations.map((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === messageId ? { ...m, imageProposalStatus: "dismissed" as const } : m
              ),
            })),
          },
        };
      });
      return;
    }

    // Photo web : pas d'appel modèle, affichage immédiat après autorisation.
    if (proposal.kind === "web" && proposal.url) {
      commitImageArtefact(messageId, proposal, proposal.url, "web");
      return;
    }

    if (proposal.kind !== "generate" || !proposal.prompt) {
      setEspaces((prev) => {
        const e = prev[id];
        return {
          ...prev,
          [id]: {
            ...e,
            conversations: e.conversations.map((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      imageProposalStatus: "error" as const,
                      text: "Proposition d'image invalide (prompt manquant).",
                    }
                  : m
              ),
            })),
          },
        };
      });
      return;
    }

    // Résout l'ancien slug nanobanana et retombe sur le modèle bon marché
    // si le gent n'a pas de modèle image assigné.
    const modelId = resolveImageModelId(espace.imageModelId);

    setEspaces((prev) => {
      const e = prev[id];
      return {
        ...prev,
        [id]: {
          ...e,
          conversations: e.conversations.map((t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    imageProposalStatus: "generating" as const,
                    imageStatus: "pending" as const,
                    text: undefined,
                  }
                : m
            ),
          })),
        },
      };
    });

    const prompt = proposal.prompt;
    fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelId }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { imageUrl?: string; error?: string };
        if (data.imageUrl) {
          commitImageArtefact(messageId, proposal!, data.imageUrl, "generated");
          return;
        }
        const detail = data.error || `erreur HTTP ${r.status}`;
        setEspaces((prev) => {
          const e = prev[id];
          return {
            ...prev,
            [id]: {
              ...e,
              conversations: e.conversations.map((t) => ({
                ...t,
                messages: t.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        imageProposalStatus: "error" as const,
                        imageStatus: "error" as const,
                        text: detail,
                      }
                    : m
                ),
              })),
            },
          };
        });
      })
      .catch((err: Error) => {
        setEspaces((prev) => {
          const e = prev[id];
          return {
            ...prev,
            [id]: {
              ...e,
              conversations: e.conversations.map((t) => ({
                ...t,
                messages: t.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        imageProposalStatus: "error" as const,
                        imageStatus: "error" as const,
                        text: err.message || "erreur réseau",
                      }
                    : m
                ),
              })),
            },
          };
        });
      });
  }, []);

  const confirmArtefactProposal = useCallback((proposalId: string, decision: "add" | "dismiss") => {
    const id = currentIdRef.current;
    let keptDocumentId: string | undefined;
    // Verdict relevé sur l'état COURANT, avant la mise à jour : React peut
    // différer l'exécution d'un updater, et une variable remplie à
    // l'intérieur serait encore vide au moment d'envoyer la mesure.
    const avant = espacesRef.current[id];
    const proposition = avant?.conversations.flatMap((t) => t.messages).find((m) => m.id === proposalId);
    const verdictMesure =
      proposition?.proposal && (!proposition.proposalStatus || proposition.proposalStatus === "pending")
        ? {
            evenement:
              decision === "dismiss"
                ? ("jete" as const)
                : cibleDuRemplacement(avant!.artefacts, proposition.proposal)
                  ? ("remplace" as const)
                  : ("garde" as const),
            forme: proposition.proposal.kind,
          }
        : null;
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
      if (targetMsg.proposalStatus && targetMsg.proposalStatus !== "pending") return prev;

      let artefacts = espace.artefacts;
      let themeTabs = espace.themeTabs ?? [];
      let newArtefactId: string | undefined;
      // Même titre qu'un artefact gardé : c'est sa version mise à jour, qui le
      // REMPLACE sur place — même id, donc même onglet. L'ajouter à côté
      // produisait un doublon à chaque retouche demandée au gent.
      const homonyme = decision === "add" ? cibleDuRemplacement(espace.artefacts, targetMsg.proposal) : undefined;
      if (homonyme) {
        newArtefactId = homonyme.id;
        // L'état précédent rejoint l'historique : une retouche appliquée, ou
        // une version complète qui remplace, n'écrase plus rien.
        const misAJour = avecNouvelleVersion(
          homonyme,
          artefactFromProposal(targetMsg.proposal, homonyme.id),
          targetMsg.proposal.modification?.resume ?? "nouvelle version complète",
          horodatage()
        );
        // En tête, comme un nouvel artefact : c'est lui que l'espace montre.
        artefacts = [misAJour, ...espace.artefacts.filter((a) => a.id !== homonyme.id)];
        if (misAJour.document) keptDocumentId = misAJour.id;
      } else if (decision === "add") {
        newArtefactId = `artef-${Date.now()}`;
        const newArtefact = artefactFromProposal(targetMsg.proposal, newArtefactId);
        artefacts = [newArtefact, ...espace.artefacts];
        if (newArtefact.document) keptDocumentId = newArtefact.id;
        // Rangé tout seul dans un onglet nommé d'après son contenu.
        // Si le même tour proposait aussi un THEME_TAB, on l'applique ici
        // (sans carte de confirmation) et on y greffe le nouvel artefact.
        if (targetMsg.themeProposal) {
          const action = themeActionWithArtefact(targetMsg.themeProposal, newArtefactId);
          themeTabs = applyThemeTabAction(themeTabs, action);
          if (action.action !== "create") {
            themeTabs = upsertArtefactThemeTab(themeTabs, newArtefact, [espace.gent, espace.name]);
          }
        } else {
          themeTabs = upsertArtefactThemeTab(themeTabs, newArtefact, [espace.gent, espace.name]);
        }
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
                      themeProposalStatus: m.themeProposal
                        ? decision === "add"
                          ? ("applied" as const)
                          : ("dismissed" as const)
                        : m.themeProposalStatus,
                      ref: newArtefactId,
                    }
                  : m
              ),
            }
          : t
      );

      return { ...prev, [id]: { ...espace, artefacts, themeTabs, conversations } };
    });
    setPendingArtefactVerdict((p) => (p?.proposalMessageId === proposalId ? null : p));
    if (keptDocumentId) setViewerArtefactId(keptDocumentId);
    if (verdictMesure) {
      mesurerArtefact({
        ...verdictMesure,
        mode: shareToken ? "lien" : "espace",
        modele: avant?.chatModelId,
        frequence: avant?.frequenceArtefacts,
        gent: avant?.gent,
      });
    }
  }, [shareToken]);

  const changeArtefactKind = useCallback((artefactId: string, kind: WorkspaceArtefactKind) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      if (!espace) return prev;
      const current = espace.artefacts.find((a) => a.id === artefactId);
      if (!current) return prev;
      const updated = convertArtefactToKind(current, kind);
      const artefacts = espace.artefacts.map((a) => (a.id === artefactId ? updated : a));
      const themeTabs = upsertArtefactThemeTab(espace.themeTabs ?? [], updated, [espace.gent, espace.name]);
      return { ...prev, [id]: { ...espace, artefacts, themeTabs } };
    });
  }, []);

  const generateProfileSummaryMedia = useCallback((artefactId: string, mediaId: string) => {
    const id = currentIdRef.current;
    const espace = espacesRef.current[id];
    if (!espace) return;
    const artefact = espace.artefacts.find((a) => a.id === artefactId);
    const media = artefact?.profileSummary?.media?.find((m) => m.id === mediaId);
    if (!media || media.kind !== "generate" || !media.prompt) return;
    if (media.status === "generating" || media.status === "ready") return;

    const modelId = resolveImageModelId(espace.imageModelId);
    const prompt = media.prompt;

    setEspaces((prev) => {
      const e = prev[id];
      return {
        ...prev,
        [id]: {
          ...e,
          artefacts: e.artefacts.map((a) => {
            if (a.id !== artefactId || !a.profileSummary?.media) return a;
            return {
              ...a,
              profileSummary: {
                ...a.profileSummary,
                media: a.profileSummary.media.map((m) =>
                  m.id === mediaId ? { ...m, status: "generating" as const } : m
                ),
              },
            };
          }),
        },
      };
    });

    fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelId }),
    })
      .then((r) => r.json())
      .then((data: { imageUrl?: string }) => {
        setEspaces((prev) => {
          const e = prev[id];
          return {
            ...prev,
            [id]: {
              ...e,
              artefacts: e.artefacts.map((a) => {
                if (a.id !== artefactId || !a.profileSummary?.media) return a;
                return {
                  ...a,
                  profileSummary: {
                    ...a.profileSummary,
                    media: a.profileSummary.media.map((m) =>
                      m.id === mediaId
                        ? data.imageUrl
                          ? { ...m, imageUrl: data.imageUrl, status: "ready" as const }
                          : { ...m, status: "error" as const }
                        : m
                    ),
                  },
                };
              }),
            },
          };
        });
      })
      .catch(() => {
        setEspaces((prev) => {
          const e = prev[id];
          return {
            ...prev,
            [id]: {
              ...e,
              artefacts: e.artefacts.map((a) => {
                if (a.id !== artefactId || !a.profileSummary?.media) return a;
                return {
                  ...a,
                  profileSummary: {
                    ...a.profileSummary,
                    media: a.profileSummary.media.map((m) =>
                      m.id === mediaId ? { ...m, status: "error" as const } : m
                    ),
                  },
                };
              }),
            },
          };
        });
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

  /**
   * Remplace un artefact par sa version modifiée (outils, autre onglet).
   * `resume` présent : une ÉDITION, qui range l'état précédent dans
   * l'historique. Absent : un simple état (case cochée), sans version.
   */
  const modifierArtefact = useCallback((artefactId: string, apres: Artefact, resume?: string) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      if (!espace) return prev;
      const artefacts = espace.artefacts.map((a) => {
        if (a.id !== artefactId) return a;
        return resume
          ? avecNouvelleVersion(a, { ...apres, id: a.id }, resume, horodatage())
          : { ...apres, id: a.id, versions: a.versions };
      });
      return { ...prev, [id]: { ...espace, artefacts } };
    });
  }, []);

  // Un artefact ouvert dans un AUTRE ONGLET renvoie ses modifications par le
  // localStorage. L'événement `storage` ne se déclenche que dans les autres
  // onglets : celui qui écrit ne se relit jamais, pas de boucle possible.
  useEffect(() => {
    function recevoir(e: StorageEvent) {
      if (!e.key?.startsWith(PREFIXE_ONGLET)) return;
      const m = lireMessageOnglet(e.newValue);
      if (!m || m.source !== "onglet" || m.espaceId !== currentIdRef.current) return;
      modifierArtefact(m.artefact.id, m.artefact, m.resume);
    }
    window.addEventListener("storage", recevoir);
    return () => window.removeEventListener("storage", recevoir);
  }, [modifierArtefact]);

  const restaurerVersionArtefact = useCallback((artefactId: string, n: number) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      const artefacts = espace.artefacts.map((a) => (a.id === artefactId ? restaurerVersion(a, n, horodatage()) ?? a : a));
      return { ...prev, [id]: { ...espace, artefacts } };
    });
  }, []);

  const toggleBlocChecklist = useCallback((artefactId: string, blocId: string, itemIndex: number) => {
    const id = currentIdRef.current;
    setEspaces((prev) => {
      const espace = prev[id];
      const artefacts = espace.artefacts.map((a) => {
        if (a.id !== artefactId || !a.dashboard) return a;
        const blocks = a.dashboard.blocks.map((b) =>
          b.id === blocId && b.type === "checklist"
            ? { ...b, items: b.items.map((it, i) => (i === itemIndex ? { ...it, checked: !it.checked } : it)) }
            : b
        );
        return { ...a, dashboard: { ...a.dashboard, blocks } };
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
        pendingArtefactVerdict,
        verdictEnVolet,
        declarerVoletVerdict,
        viewerArtefactId,
        documentViewerOpen: !!viewerArtefactId,
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
        closeDocumentViewer,
        updateMemory,
        sendMessage,
        demanderArtefact,
        submitJumpForm,
        runStarter,
        ensureStarters,
        storageReady,
        isThinking,
        thinkingStatus,
        artefactEnPreparation,
        stopGeneration,
        userPosition,
        geoStatus,
        requestGeolocation,
        confirmGeoRequest,
        removeArtefact,
        changeArtefactKind,
        viewArtefact,
        refreshPinnedArtefact,
        resetPinnedArtefact,
        updatePinnedInput,
        pinnedRefreshing,
        pinnedError,
        shareMode,
        miniAppMode: !!currentEspace.pinnedArtefact?.enabled,
        modeJeu: !!currentEspace.moteurJeu,
        addFile,
        removeFile,
        addDocumentArtefact,
        confirmArtefactProposal,
        confirmThemeProposal,
        confirmImageProposal,
        generateProfileSummaryMedia,
        confirmProfileProposal,
        toggleChecklistItem,
        toggleBlocChecklist,
        restaurerVersionArtefact,
        modifierArtefact,
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
