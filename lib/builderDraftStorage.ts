import type { GentDraft, GentDraftsMap } from "@/lib/types/builder";
import type { Espace } from "@/lib/types";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { appAccessHeaders } from "@/lib/appAccess";

export const DRAFTS_STORAGE_KEY = "getgents:gent-drafts";
export const NOUVEAU_GENT_TEMPLATE_ID = "nouveau-gent";

/** Gabarit vierge — toujours relire depuis les mock data, jamais depuis le localStorage. */
export function freshDraftFromTemplate(id: string): GentDraft {
  return {
    ...JSON.parse(JSON.stringify(GENT_DRAFTS[NOUVEAU_GENT_TEMPLATE_ID])),
    id,
    updatedAt: "à l'instant",
  };
}

export function createDraftId(): string {
  return `draft-${Date.now()}`;
}

/** Retire le slot gabarit de la carte persistée (il ne doit pas être sauvegardé). */
export function draftsForPersistence(drafts: GentDraftsMap): GentDraftsMap {
  const { [NOUVEAU_GENT_TEMPLATE_ID]: _removed, ...rest } = drafts;
  return rest;
}

export function readStoredDrafts(): GentDraftsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GentDraftsMap;
    delete parsed[NOUVEAU_GENT_TEMPLATE_ID];
    return parsed;
  } catch {
    return {};
  }
}

export function writeStoredDrafts(drafts: GentDraftsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(draftsForPersistence(drafts)));
  } catch {
    // quota dépassé / navigation privée
  }
}

// --- Persistance serveur -------------------------------------------------
// Même modèle que lib/publishedGents.ts : le localStorage devient un cache
// d'affichage immédiat, la base est la source de vérité. Un brouillon créé sur
// une machine se retrouve donc sur les autres, et survit au vidage du cache.

// null = pas encore sondé ; false = API absente/non autorisée (on cesse
// d'essayer pour la session) ; true = distant opérationnel.
let remoteAvailable: boolean | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 1500;

/** À appeler quand la clé APP_ACCESS_SECRET est (re)saisie — relance les syncs. */
export function resetDraftsRemoteAvailability(): void {
  remoteAvailable = null;
}

/** Récupère les brouillons depuis le serveur — null si indisponible. */
export async function fetchRemoteDrafts(): Promise<GentDraftsMap | null> {
  if (remoteAvailable === false) return null;
  try {
    const res = await fetch("/api/drafts", { cache: "no-store", headers: appAccessHeaders() });
    if (res.status === 503 || res.status === 401) {
      remoteAvailable = false;
      return null;
    }
    if (!res.ok) return null;
    remoteAvailable = true;
    const data = (await res.json()) as { drafts?: GentDraftsMap };
    const drafts = data.drafts ?? {};
    delete drafts[NOUVEAU_GENT_TEMPLATE_ID];
    return drafts;
  } catch {
    return null;
  }
}

/** Pousse un brouillon vers le serveur, débouncé par id (l'édition est frappe à frappe). */
export function pushRemoteDraft(id: string, draft: GentDraft): void {
  if (remoteAvailable === false || id === NOUVEAU_GENT_TEMPLATE_ID) return;
  const pending = pushTimers.get(id);
  if (pending) clearTimeout(pending);
  pushTimers.set(
    id,
    setTimeout(() => {
      pushTimers.delete(id);
      fetch(`/api/drafts/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...appAccessHeaders() },
        body: JSON.stringify({ draft }),
      })
        .then((res) => {
          if (res.status === 503 || res.status === 401) remoteAvailable = false;
          else if (res.ok) remoteAvailable = true;
        })
        .catch(() => {
          // Réseau indisponible : le cache local garde le brouillon, la
          // prochaine édition retentera.
        });
    }, PUSH_DEBOUNCE_MS)
  );
}

/**
 * Hydratation au chargement : fusionne le distant (source de vérité) par-dessus
 * le cache local, met le cache à jour, et renvoie la map fusionnée — ou null si
 * le distant est indisponible (le cache local reste alors la seule source).
 * Les brouillons présents seulement en local (créés hors ligne ou avant la
 * configuration de Supabase) remontent vers le serveur.
 */
export async function syncDraftsFromRemote(): Promise<GentDraftsMap | null> {
  const remote = await fetchRemoteDrafts();
  if (remote === null) return null;
  const merged = { ...readStoredDrafts(), ...remote };
  writeStoredDrafts(merged);
  for (const [id, draft] of Object.entries(merged)) {
    if (!(id in remote)) pushRemoteDraft(id, draft);
  }
  return merged;
}

/** Crée un brouillon vierge, l'enregistre (local + serveur) et renvoie son identifiant. */
export function allocateNewDraft(): string {
  const id = createDraftId();
  const stored = readStoredDrafts();
  const draft = freshDraftFromTemplate(id);
  stored[id] = draft;
  writeStoredDrafts(stored);
  // Persistance immédiate : un gent tout juste créé ne doit pas dépendre d'une
  // édition ultérieure pour exister côté serveur.
  pushRemoteDraft(id, draft);
  return id;
}

export function seedDrafts(initialId: string): GentDraftsMap {
  const drafts: GentDraftsMap = JSON.parse(JSON.stringify(GENT_DRAFTS));
  drafts[NOUVEAU_GENT_TEMPLATE_ID] = JSON.parse(JSON.stringify(GENT_DRAFTS[NOUVEAU_GENT_TEMPLATE_ID]));
  if (!drafts[initialId] && initialId !== NOUVEAU_GENT_TEMPLATE_ID) {
    drafts[initialId] = freshDraftFromTemplate(initialId);
  }
  return drafts;
}

export function mergeStoredDrafts(prev: GentDraftsMap): GentDraftsMap {
  const stored = readStoredDrafts();
  if (!Object.keys(stored).length) return prev;
  const merged = { ...prev, ...stored };
  merged[NOUVEAU_GENT_TEMPLATE_ID] = JSON.parse(JSON.stringify(GENT_DRAFTS[NOUVEAU_GENT_TEMPLATE_ID]));
  return merged;
}

/** Liste tous les brouillons visibles (mock + localStorage), hors gabarit. */
export function listVisibleDrafts(): GentDraft[] {
  const merged = mergeStoredDrafts(seedDrafts("_dashboard"));
  return Object.values(merged)
    .filter((d) => d.id !== NOUVEAU_GENT_TEMPLATE_ID)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Recrée un brouillon builder à partir d'un gent publié (récupération). */
export function restoreDraftFromPublished(id: string, espace: Espace): GentDraft {
  const base = freshDraftFromTemplate(id);
  const connectors = connectorsFromPublishedEspace(espace);
  // Artefact figé : on reprend la config (mission, entrées) sans le rendu
  // personnel ni l'historique de runs — le créateur régénère au besoin.
  const pinned = espace.pinnedArtefact
    ? {
        enabled: espace.pinnedArtefact.enabled,
        title: espace.pinnedArtefact.title,
        mission: espace.pinnedArtefact.mission,
        inputs: espace.pinnedArtefact.inputs.map((i) => ({
          id: i.id,
          label: i.label,
          kind: i.kind,
        })),
      }
    : undefined;
  return {
    ...base,
    id,
    name: espace.gent || espace.name,
    icon: espace.icon,
    objective: espace.name !== (espace.gent || espace.name) ? espace.name : espace.gent || espace.name,
    systemPrompt: espace.systemPrompt ?? "",
    status: "published",
    webSearch: espace.webSearch,
    jumpForm: espace.jumpForm,
    connectors,
    pinnedArtefact: pinned,
    routine: espace.routine
      ? {
          enabled: espace.routine.enabled,
          frequency: espace.routine.frequency,
          hour: espace.routine.hour,
          mission: espace.routine.mission,
        }
      : undefined,
    channel: espace.channel
      ? {
          kind: espace.channel.kind,
          enabled: espace.channel.enabled,
          to: espace.channel.to,
          templateName: espace.channel.templateName,
          templateLang: espace.channel.templateLang,
        }
      : undefined,
    modelAssignments: base.modelAssignments.map((a) =>
      a.capability === "chat" ? { ...a, modelId: espace.chatModelId ?? a.modelId } : a
    ),
    updatedAt: "restauré à l'instant",
  };
}

function connectorsFromPublishedEspace(espace: Espace): GentDraft["connectors"] {
  const connectors: GentDraft["connectors"] = [];
  let n = 0;
  for (const d of espace.datasets ?? []) {
    connectors.push({ id: `restored-${n++}`, toolKind: "dataset", name: d.name, detail: d.url });
  }
  for (const m of espace.mcpServers ?? []) {
    connectors.push({ id: `restored-${n++}`, toolKind: "mcp", name: m.name, detail: m.url });
  }
  if (espace.prim) {
    connectors.push({ id: `restored-${n++}`, toolKind: "prim", name: "IDFM PRIM" });
  }
  if (espace.powens) {
    connectors.push({ id: `restored-${n++}`, toolKind: "powens", name: "Powens (sandbox)" });
  }
  for (const r of espace.restApis ?? []) {
    connectors.push({
      id: `restored-${n++}`,
      toolKind: "api-rest",
      name: r.name,
      restConfig: r.config,
    });
  }
  return connectors;
}

/** Enregistre un brouillon restauré depuis un espace publié. */
export function saveRestoredDraft(draft: GentDraft): void {
  const stored = readStoredDrafts();
  stored[draft.id] = draft;
  writeStoredDrafts(stored);
}
