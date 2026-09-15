import type { Espace } from "@/lib/types";

/**
 * Deux versions coexistent pour un même gent (voir migration 004) :
 *
 *   espace   — version de TRAVAIL. Réécrite dès que le créateur ouvre Preview,
 *              elle porte donc des modifications en cours, potentiellement
 *              incohérentes. Réservée au studio et à la Preview du créateur.
 *   diffused — version DIFFUSÉE. Figée au clic sur « Diffuser le gent », c'est
 *              la seule que doivent voir les destinataires réels.
 *
 * Tout ce qui sert un utilisateur final (lien de partage, iframe, WhatsApp,
 * routine planifiée) doit passer par ce sélecteur, jamais lire `espace`
 * directement — sinon un simple Preview du créateur partirait en production.
 */
export interface GentRow {
  espace?: unknown;
  diffused?: unknown;
}

/**
 * Version à servir aux utilisateurs finaux. Repli sur la version de travail
 * quand aucune diffusion n'a encore eu lieu : les gents créés avant la
 * séparation n'ont pas de colonne `diffused` remplie, et les couper
 * brutalement casserait des liens de partage déjà distribués.
 */
export function diffusedEspace(row: GentRow | null | undefined): Espace | null {
  if (!row) return null;
  const diffused = row.diffused;
  if (diffused && typeof diffused === "object") return diffused as Espace;
  const working = row.espace;
  if (working && typeof working === "object") return working as Espace;
  return null;
}

/** Colonnes à sélectionner pour pouvoir résoudre la version diffusée. */
export const DIFFUSED_COLUMNS = "espace, diffused";
