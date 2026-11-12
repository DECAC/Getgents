/**
 * Rubrique « Pages » (GetSite) — fonctions PURES de l'interface : filtres,
 * recherche, libellés. Testées sans navigateur.
 */

import type { FormatArtefact } from "./mcpPartage";

export interface LignePage {
  id: string;
  titre: string;
  format: FormatArtefact;
  origine: string | null;
  assistant: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  actifs: number;
  liens: number;
  expireLe: string | null;
  dernierJeton: string | null;
}

export type FiltrePages = "actives" | "expirees" | "toutes";

/** « Actives » : au moins un lien qui s'ouvre encore. « Sans lien actif » : tous révoqués ou expirés. */
export function filtrePage(p: Pick<LignePage, "actifs">, f: FiltrePages): boolean {
  if (f === "toutes") return true;
  return f === "actives" ? p.actifs > 0 : p.actifs === 0;
}

const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Recherche sans accents ni casse, chaque mot exigé — comme « Mes gents ». */
export function filtrerParTitre<T extends { titre: string; origine?: string | null }>(liste: T[], recherche: string): T[] {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  if (!mots.length) return liste;
  return liste.filter((p) => {
    const cible = sansAccents(`${p.titre} ${p.origine ?? ""}`);
    return mots.every((m) => cible.includes(m));
  });
}

const FORMATS: Record<FormatArtefact, string> = { html: "HTML", markdown: "Texte mis en forme", svg: "Image", react: "Application", texte: "Texte" };
export const libelleFormat = (f: FormatArtefact) => FORMATS[f] ?? f;

/** Initiales d'un destinataire : « Marie Dupont » → MD, « paul@acme.fr » → PA. */
export function initiales(destinataire: string): string {
  const nom = destinataire.includes("@") ? destinataire.split("@")[0].replace(/[._-]+/g, " ") : destinataire;
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}
