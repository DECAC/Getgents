// Un statut de gent, les MÊMES mots partout : la liste du studio disait
// « Publié », celle de GetSpace « Actif » ou « Privé », pour le même état.
//
// Module PUR.

export type StatutGent = "brouillon" | "diffuse" | "prive";

export const LIBELLE_STATUT: Record<StatutGent, string> = {
  brouillon: "Brouillon",
  diffuse: "Diffusé",
  prive: "Privé",
};

/** Statut d'un gent, à partir de son brouillon ou de son espace. */
export function statutGent(g: { status?: string; diffusionPrivee?: boolean } | null | undefined): StatutGent {
  if (g?.diffusionPrivee) return "prive";
  // Brouillon du studio : draft / review / published. Espace de GetSpace :
  // live / paused / done — il n'existe que parce qu'il a été diffusé.
  return g?.status && ["published", "live", "paused", "done"].includes(g.status) ? "diffuse" : "brouillon";
}

/** Un gent qu'on peut OUVRIR pour s'en servir : il a été diffusé au moins une fois. */
export function peutEtreOuvert(statut: StatutGent): boolean {
  return statut !== "brouillon";
}
