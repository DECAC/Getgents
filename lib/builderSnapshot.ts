import type { GentDraft } from "@/lib/types/builder";
import type { NotificationChannel, PinnedArtefact, Routine } from "@/lib/types";

export const DEFAULT_DRAFT_NAME = "Nouveau gent";

/** Un nom qui n'a jamais été personnalisé ne doit pas pouvoir être publié. */
export function hasCustomName(draft: GentDraft): boolean {
  const trimmed = draft.name.trim();
  return trimmed !== "" && trimmed !== DEFAULT_DRAFT_NAME;
}

/** Empreinte config de l'artefact figé — hors rendu / valeurs utilisateur. */
function pinnedSnapshot(pinned?: PinnedArtefact) {
  if (!pinned) return null;
  return {
    enabled: pinned.enabled,
    title: pinned.title,
    mission: pinned.mission,
    inputs: pinned.inputs.map((i) => ({ id: i.id, label: i.label, kind: i.kind })),
  };
}

/** Empreinte routine — hors horodatage d'exécution. */
function routineSnapshot(routine?: Routine) {
  if (!routine) return null;
  return {
    enabled: routine.enabled,
    frequency: routine.frequency,
    hour: routine.hour,
    mission: routine.mission,
  };
}

/** Empreinte canal — hors notes de livraison. */
function channelSnapshot(channel?: NotificationChannel) {
  if (!channel) return null;
  return {
    kind: channel.kind,
    enabled: channel.enabled,
    to: channel.to,
    templateName: channel.templateName ?? null,
    templateLang: channel.templateLang ?? null,
  };
}

/**
 * Empreinte du contenu "publiable" d'un draft (tout ce qui influence
 * l'espace généré, hors conversation avec l'assistant du builder et
 * métadonnées de statut) — sert à savoir si une V déjà publiée a été
 * modifiée depuis, pour réautoriser le bouton Publier.
 *
 * Inclut notamment pinnedArtefact / routine / channel : sans eux, une
 * modification dans les configurateurs du Prompt (mini-app, veille…)
 * laissait le bouton coincé sur « Publié ».
 */
export function draftContentSnapshot(draft: GentDraft): string {
  return JSON.stringify({
    name: draft.name,
    objective: draft.objective,
    systemPrompt: draft.systemPrompt,
    modelAssignments: draft.modelAssignments,
    knowledgeSources: draft.knowledgeSources,
    connectors: draft.connectors,
    webSearch: draft.webSearch,
    jumpForm: draft.jumpForm,
    pinnedArtefact: pinnedSnapshot(draft.pinnedArtefact),
    routine: routineSnapshot(draft.routine),
    channel: channelSnapshot(draft.channel),
  });
}

export function isDirtySincePublish(draft: GentDraft): boolean {
  if (draft.status !== "published") return false;
  return draft.publishedSnapshot !== draftContentSnapshot(draft);
}
