import type { GentDraft, GentDraftsMap } from "@/lib/types/builder";
import type { Espace } from "@/lib/types";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { apiFetchInit, signalerSessionExpiree } from "@/lib/apiFetch";
import { cacheKey } from "@/lib/session/currentUser";
import { suggestGentIcon } from "@/lib/gentIcons";

// Base de la clé : la clé RÉELLE porte l'identifiant du compte (voir
// lib/storageScope.ts). Un brouillon contient le prompt système en cours
// d'écriture et les documents de connaissance de son auteur.
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

/** Identifiants réservés au système — jamais des vrais gents. */
export const RESERVED_DRAFT_IDS = [NOUVEAU_GENT_TEMPLATE_ID, "_dashboard"] as const;

export function isPersistableDraftId(id: string): boolean {
  return !!id.trim() && !(RESERVED_DRAFT_IDS as readonly string[]).includes(id);
}

/** Retire le slot gabarit de la carte persistée (il ne doit pas être sauvegardé). */
export function draftsForPersistence(drafts: GentDraftsMap): GentDraftsMap {
  const out: GentDraftsMap = {};
  for (const [id, draft] of Object.entries(drafts)) {
    if (isPersistableDraftId(id)) out[id] = draft;
  }
  return out;
}

export function readStoredDrafts(): GentDraftsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(cacheKey(DRAFTS_STORAGE_KEY));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GentDraftsMap;
    for (const reserved of RESERVED_DRAFT_IDS) delete parsed[reserved];
    return parsed;
  } catch {
    return {};
  }
}

export function writeStoredDrafts(drafts: GentDraftsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(DRAFTS_STORAGE_KEY), JSON.stringify(draftsForPersistence(drafts)));
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

/**
 * Annule les envois différés en attente. Voir la note jumelle dans
 * lib/publishedGents.ts : un push programmé juste avant une déconnexion
 * partirait avec la session du compte SUIVANT.
 */
export function cancelPendingDraftPushes(): void {
  pushTimers.forEach((timer) => clearTimeout(timer));
  pushTimers.clear();
}


/** À appeler quand la clé APP_ACCESS_SECRET est (re)saisie — relance les syncs. */
export function resetDraftsRemoteAvailability(): void {
  remoteAvailable = null;
}

/** Récupère les brouillons depuis le serveur — null si indisponible, 'unauthorized' si 401. */
export async function fetchRemoteDrafts(): Promise<GentDraftsMap | null | "unauthorized"> {
  if (remoteAvailable === false) return null;
  try {
    const res = await fetch("/api/drafts", {
      cache: "no-store",
      credentials: "include",
    });
    if (res.status === 401) {
      // La session a expiré : plus rien à saisir, il faut se reconnecter.
      // L'événement laisse l'interface décider — ce module ne connaît ni le
      // routeur ni l'écran à afficher.
      remoteAvailable = false;
      signalerSessionExpiree();
      return "unauthorized";
    }
    if (res.status === 503) {
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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
export async function syncDraftsFromRemote(): Promise<GentDraftsMap | null | "unauthorized"> {
  const remote = await fetchRemoteDrafts();
  if (remote === "unauthorized") return "unauthorized";
  if (remote === null) return null;
  const merged = { ...readStoredDrafts(), ...remote };
  writeStoredDrafts(merged);
  for (const [id, draft] of Object.entries(merged)) {
    if (!(id in remote)) pushRemoteDraft(id, draft);
  }
  return merged;
}

/**
 * Supprime un brouillon : cache local retiré immédiatement, puis suppression
 * serveur. Action explicite de l'utilisateur — on attend la réponse pour
 * pouvoir signaler un échec, contrairement aux écritures fire-and-forget.
 */
export async function deleteRemoteDraft(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "unavailable" };

  const pending = pushTimers.get(id);
  if (pending) {
    clearTimeout(pending);
    pushTimers.delete(id);
  }
  const stored = readStoredDrafts();
  delete stored[id];
  writeStoredDrafts(stored);

  if (remoteAvailable === false) return { ok: true };
  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 401) {
      remoteAvailable = false;
      return { ok: true };
    }
    if (res.status === 503) {
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

/**
 * Crée un brouillon à partir du rôle décrit sur l'accueil du studio.
 *
 * La description sert d'objectif provisoire (elle s'affiche donc immédiatement
 * dans le bandeau et la liste des gents) et reste en attente dans
 * `pendingBuilderMessage` : le builder la rejoue dans l'assistant à
 * l'ouverture, pour que l'échange se poursuive sans que le créateur ait à se
 * répéter. L'emblème vient de l'exemple choisi, ou se déduit de la
 * description — sans quoi tous les gents naîtraient avec la même étoile.
 */
export function allocateDraftFromDescription(description: string, icon?: string): string {
  const role = description.trim();
  const id = createDraftId();
  const stored = readStoredDrafts();
  const draft: GentDraft = {
    ...freshDraftFromTemplate(id),
    icon: icon?.trim() || suggestGentIcon(role),
    objective: role.slice(0, 240),
    pendingBuilderMessage: role,
  };
  stored[id] = draft;
  writeStoredDrafts(stored);
  pushRemoteDraft(id, draft);
  return id;
}

/** Retire la description en attente du cache local (elle vient d'être rejouée). */
export function clearStoredPendingBuilderMessage(id: string): void {
  const stored = readStoredDrafts();
  const draft = stored[id];
  if (!draft?.pendingBuilderMessage) return;
  stored[id] = { ...draft, pendingBuilderMessage: undefined };
  writeStoredDrafts(stored);
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

/** Liste tous les brouillons visibles (mock + localStorage), hors gabarits système. */
export function listVisibleDrafts(): GentDraft[] {
  const base: GentDraftsMap = JSON.parse(JSON.stringify(GENT_DRAFTS));
  for (const reserved of RESERVED_DRAFT_IDS) delete base[reserved];
  const merged = mergeStoredDrafts(base);
  for (const reserved of RESERVED_DRAFT_IDS) delete merged[reserved];
  return Object.values(merged)
    .filter((d) => isPersistableDraftId(d.id))
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
    fileDownloadEnabled: espace.fileDownloadEnabled,
    fileDownloadFormEnabled: espace.fileDownloadFormEnabled,
    jumpForm: espace.jumpForm,
    connectors,
    pinnedArtefact: pinned,
    appPreview: espace.appPreview,
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
