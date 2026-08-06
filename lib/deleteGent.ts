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
