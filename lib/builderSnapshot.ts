import type { GentDraft } from "@/lib/types/builder";

export const DEFAULT_DRAFT_NAME = "Nouveau gent";

/** Un nom qui n'a jamais été personnalisé ne doit pas pouvoir être publié. */
export function hasCustomName(draft: GentDraft): boolean {
  const trimmed = draft.name.trim();
  return trimmed !== "" && trimmed !== DEFAULT_DRAFT_NAME;
}

/**
 * Empreinte du contenu "publiable" d'un draft (tout ce qui influence
 * l'espace généré, hors conversation avec l'assistant du builder et
 * métadonnées de statut) — sert à savoir si une V déjà publiée a été
 * modifiée depuis, pour réautoriser le bouton Publier.
 */
export function draftContentSnapshot(draft: GentDraft): string {
  return JSON.stringify({
    name: draft.name,
    objective: draft.objective,
    systemPrompt: draft.systemPrompt,
    modelAssignments: draft.modelAssignments,
    knowledgeSources: draft.knowledgeSources,
    connectors: draft.connectors,
    artefactTemplates: draft.artefactTemplates,
    webSearch: draft.webSearch,
  });
}

export function isDirtySincePublish(draft: GentDraft): boolean {
  if (draft.status !== "published") return false;
  return draft.publishedSnapshot !== draftContentSnapshot(draft);
}
