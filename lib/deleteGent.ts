import { deletePublishedGent } from "@/lib/publishedGents";
import { deleteRemoteDraft } from "@/lib/builderDraftStorage";

export interface DeleteGentResult {
  ok: boolean;
  error?: string;
}

/**
 * Supprime un gent partout où il peut exister — brouillon builder ET gent
 * publié (ce dernier entraîne aussi la suppression de ses liens de partage,
 * côté serveur, voir DELETE /api/gents/[id]). L'utilisateur ne raisonne pas en
 * « brouillon vs publié » : « supprimer ce gent » doit couvrir les deux, que
 * l'un des deux existe ou non (supprimer un id absent d'une table est un
 * no-op réussi côté serveur, pas une erreur).
 */
export async function deleteGentEverywhere(id: string): Promise<DeleteGentResult> {
  const [draftResult, publishedResult] = await Promise.all([deleteRemoteDraft(id), deletePublishedGent(id)]);
  if (!draftResult.ok) return draftResult;
  if (!publishedResult.ok) return publishedResult;
  return { ok: true };
}

/** Texte de confirmation pour une suppression d'un ou plusieurs gents. */
export function confirmDeleteGentsMessage(names: string[]): string {
  const cleaned = names.map((n) => n.trim() || "ce gent");
  if (cleaned.length <= 1) {
    const name = cleaned[0] ?? "ce gent";
    return `Supprimer définitivement « ${name} » ? Cette action est irréversible : le brouillon, le gent publié et ses liens de partage seront effacés.`;
  }
  const shown = cleaned.slice(0, 8);
  const rest = cleaned.length - shown.length;
  const list = shown.map((n) => `« ${n} »`).join(", ");
  const extra = rest > 0 ? ` et ${rest} autre${rest > 1 ? "s" : ""}` : "";
  return (
    `Supprimer définitivement ${cleaned.length} gents (${list}${extra}) ? ` +
    "Cette action est irréversible : brouillons, versions publiées et liens de partage seront effacés."
  );
}
