import type { Artefact } from "@/lib/types";
import type { ArtefactKind } from "@/lib/artefactSignal";

/**
 * Types d'artefact proposés dans l'espace (signal ARTEFACT + illustrations).
 * Aligné sur `ArtefactProposal.kind` — ne pas en inventer d'autres.
 */
export type WorkspaceArtefactKind = ArtefactKind | "image";

export const WORKSPACE_ARTEFACT_KINDS: WorkspaceArtefactKind[] = [
  "report",
  "checklist",
  "chart",
  "visual",
  "map",
  "dashboard",
  "profile-summary",
  "image",
];

export const ARTEFACT_KIND_META: Record<WorkspaceArtefactKind, { type: string; icon: string }> = {
  report: { type: "Rapport", icon: "📄" },
  checklist: { type: "Checklist", icon: "✅" },
  chart: { type: "Graphique", icon: "📊" },
  visual: { type: "Aperçu visuel", icon: "🖼️" },
  map: { type: "Carte", icon: "🗺️" },
  dashboard: { type: "Tableau de bord", icon: "📈" },
  image: { type: "Image", icon: "🖼️" },
  "profile-summary": { type: "Résumé de profil", icon: "👤" },
};

export function isWorkspaceArtefactKind(value: string): value is WorkspaceArtefactKind {
  return (WORKSPACE_ARTEFACT_KINDS as string[]).includes(value);
}

export function kindFromTypeLabel(type: string): WorkspaceArtefactKind | null {
  const needle = type.trim().toLowerCase();
  const found = WORKSPACE_ARTEFACT_KINDS.find((k) => ARTEFACT_KIND_META[k].type.toLowerCase() === needle);
  return found ?? null;
}

/** Devine le kind d'un artefact déjà stocké (sans champ `kind`, ou kind inconnu). */
export function inferArtefactKind(artefact: Artefact): WorkspaceArtefactKind {
  if (artefact.kind && isWorkspaceArtefactKind(artefact.kind)) return artefact.kind;
  const fromLabel = kindFromTypeLabel(artefact.type);
  if (fromLabel) return fromLabel;
  if (artefact.imageUrl) return "image";
  if (artefact.dashboard) return "dashboard";
  if (artefact.profileSummary) return "profile-summary";
  if (artefact.mapPoints?.length) return "map";
  if (artefact.checklistItems?.length) return "checklist";
  if (artefact.chartData?.length) return "chart";
  if (artefact.visual) return "visual";
  return "report";
}

// La conversion d'un artefact vers un autre type vit dans
// `lib/artefactConversion.ts` : elle transforme la charge utile, pas
// seulement le libellé, et ne peut donc pas rester ici sans créer un cycle
// d'imports avec l'adaptateur de rapports.
