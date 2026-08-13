import type { GentDraft } from "@/lib/types/builder";
import { hasCustomName } from "@/lib/builderSnapshot";

/**
 * « Plan de construction » d'un gent : ce qui est configuré, ce qui manque.
 *
 * L'atelier était purement réactif — le créateur devait deviner ce qu'il lui
 * restait à faire, et la seule notion de complétude vivait enterrée dans le
 * bouton Diffuser (`publishDisabled`, BuilderRail). Cette fonction en fait un
 * état de premier plan, exploitable à la fois par l'interface et par
 * l'assistant, qui peut alors orienter vers le manque suivant.
 */
export type BuildStepId =
  | "name"
  | "objective"
  | "systemPrompt"
  | "knowledge"
  | "connectors"
  | "apercu"
  | "diffusion";

export interface BuildStep {
  id: BuildStepId;
  label: string;
  done: boolean;
  /** Une étape facultative n'empêche jamais de diffuser. */
  optional: boolean;
  /** Ce qu'il reste à faire, en une phrase — affiché en info-bulle. */
  hint: string;
}

/** Onglet du studio à ouvrir pour traiter l'étape. */
export const BUILD_STEP_TAB: Record<BuildStepId, string> = {
  name: "accueil",
  objective: "accueil",
  systemPrompt: "conversationnel",
  knowledge: "knowledge",
  connectors: "connectors",
  apercu: "apercu",
  diffusion: "diffusion",
};

export function computeBuildPlan(draft: GentDraft): BuildStep[] {
  return [
    {
      id: "name",
      label: "Nommer le gent",
      done: hasCustomName(draft),
      optional: false,
      hint: "Un nom propre, à la place de « Nouveau gent ».",
    },
    {
      id: "objective",
      label: "Définir l'objectif",
      done: !!(draft.objective ?? "").trim(),
      optional: false,
      hint: "La mission du gent, en une phrase.",
    },
    {
      id: "systemPrompt",
      label: "Rédiger les instructions",
      done: !!(draft.systemPrompt ?? "").trim(),
      optional: false,
      hint: "Le prompt système : rôle, ton, limites.",
    },
    {
      id: "knowledge",
      label: "Ajouter des connaissances",
      done: (draft.knowledgeSources ?? []).length > 0,
      optional: true,
      hint: "Documents de référence, si le gent doit s'appuyer dessus.",
    },
    {
      id: "connectors",
      label: "Brancher des sources",
      done: (draft.connectors ?? []).length > 0,
      optional: true,
      hint: "Connecteurs et API, si le gent a besoin de données réelles.",
    },
    {
      id: "apercu",
      label: "Dessiner l'application",
      done: !!draft.appPreview?.modules.length,
      optional: true,
      hint: "L'aperçu de ce que verra l'utilisateur.",
    },
    {
      id: "diffusion",
      label: "Diffuser",
      done: draft.status === "published",
      optional: false,
      hint: "Rendre le gent accessible à ses utilisateurs.",
    },
  ];
}

/**
 * Prochaine étape à traiter : le premier manque OBLIGATOIRE. Les étapes
 * facultatives ne sont jamais présentées comme un blocage — elles enrichissent
 * le gent, elles ne conditionnent pas sa diffusion.
 */
export function nextBuildGap(draft: GentDraft): BuildStep | null {
  return computeBuildPlan(draft).find((s) => !s.done && !s.optional) ?? null;
}

/** Nombre d'étapes obligatoires faites / total — pour l'entête de la checklist. */
export function buildPlanProgress(draft: GentDraft): { done: number; total: number } {
  const required = computeBuildPlan(draft).filter((s) => !s.optional);
  return { done: required.filter((s) => s.done).length, total: required.length };
}

/**
 * Résumé injecté dans le prompt système, pour que l'assistant sache où en est
 * le créateur et l'oriente spontanément. Volontairement court : il est payé à
 * chaque tour, sur tous les profils.
 */
export function buildPlanNote(draft: GentDraft): string {
  const plan = computeBuildPlan(draft);
  const missingRequired = plan.filter((s) => !s.done && !s.optional).map((s) => s.label);
  const missingOptional = plan.filter((s) => !s.done && s.optional).map((s) => s.label);

  if (!missingRequired.length && !missingOptional.length) {
    return "\n\nCe gent est complet : toutes les étapes de construction sont faites.";
  }

  // Le facultatif n'est jamais présenté comme un manque : il enrichit le gent,
  // il ne conditionne pas sa diffusion. Les confondre ferait courir le créateur
  // après des étapes qui ne le bloquent pas.
  if (!missingRequired.length) {
    return `\n\nCe gent est complet et diffusable. Pistes facultatives si l'échange s'y prête : ${missingOptional.join(", ")}.`.slice(
      0,
      300
    );
  }

  const next = missingRequired[0].toLowerCase();
  return `\n\nÉtat de construction — reste à faire : ${missingRequired.join(", ")}. Prochaine étape indispensable : ${next}. Oriente le créateur vers elle quand l'échange s'y prête, sans insister.`.slice(
    0,
    300
  );
}
