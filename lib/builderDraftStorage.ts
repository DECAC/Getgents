import type { GentDraft, GentDraftsMap } from "@/lib/types/builder";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";

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

/** Crée un brouillon vierge, l'enregistre et renvoie son identifiant. */
export function allocateNewDraft(): string {
  const id = createDraftId();
  const stored = readStoredDrafts();
  stored[id] = freshDraftFromTemplate(id);
  writeStoredDrafts(stored);
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
