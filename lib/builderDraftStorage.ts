import type { GentDraft, GentDraftsMap } from "@/lib/types/builder";
import type { Espace } from "@/lib/types";
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

/** Liste tous les brouillons visibles (mock + localStorage), hors gabarit. */
export function listVisibleDrafts(): GentDraft[] {
  const merged = mergeStoredDrafts(seedDrafts("_dashboard"));
  return Object.values(merged)
    .filter((d) => d.id !== NOUVEAU_GENT_TEMPLATE_ID)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Recrée un brouillon builder minimal à partir d'un gent publié (récupération). */
export function restoreDraftFromPublished(id: string, espace: Espace): GentDraft {
  const base = freshDraftFromTemplate(id);
  const connectors = connectorsFromPublishedEspace(espace);
  return {
    ...base,
    id,
    name: espace.name,
    icon: espace.icon,
    objective: espace.name,
    systemPrompt: espace.systemPrompt ?? "",
    status: "published",
    webSearch: espace.webSearch,
    jumpForm: espace.jumpForm,
    connectors,
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
