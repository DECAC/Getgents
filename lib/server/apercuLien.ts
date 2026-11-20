import { cache } from "react";
import { apercuDuLien, type ApercuLien } from "@/lib/apercuLien";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { protectionActive } from "@/lib/server/accesPartage";
import { engagementDeLaPage } from "@/lib/server/engagementPages";

/**
 * L'aperçu d'un lien, tel que le servent les métadonnées ET la vignette.
 * Null : lien inconnu, expiré ou révoqué — l'appelant montre une carte
 * générique, sans rien de la page. Ne lève jamais.
 */
export const apercuPourJeton = cache(async (jeton: string): Promise<ApercuLien | null> => {
  try {
    const a = await lireArtefact(jeton);
    if (!a) return null;
    // Protection illisible : on la suppose ACTIVE — l'aperçu ne doit rien laisser fuir.
    const protegee = await protectionActive(a.pageId).catch(() => true);
    const reglage = protegee ? null : await engagementDeLaPage(a.pageId).catch(() => null);
    return apercuDuLien({
      titre: a.titre,
      contenu: protegee ? "" : a.contenu,
      destinataire: a.destinataire,
      protegee,
      action: reglage?.actif ? reglage.intitule : null,
      assistant: a.assistant && !!a.ownerId,
    });
  } catch {
    return null;
  }
});

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}
