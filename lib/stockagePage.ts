// Stockage PARTAGÉ d'une page (`window.storage` des artefacts Claude, avec
// `shared` vrai) : ce que tous les lecteurs d'une page voient ensemble — les
// votes d'un sondage, un classement. Module PUR : bornes et validation.
//
// Les bornes protègent une route OUVERTE (le porteur d'un lien écrit) : une
// page ne doit pas devenir un disque gratuit.

export const CLE_MAX = 200;
export const VALEUR_MAX = 100_000;
export const CLES_MAX = 500;
export const TOTAL_MAX = 2_000_000;
export const ECRITURES_PAR_MINUTE = 60;

export type OpStockage = "get" | "set" | "delete" | "list";

export interface DemandeStockage {
  op: OpStockage;
  cle?: string;
  valeur?: string;
  prefixe?: string;
}

export type RefusStockage = "requete" | "cle" | "valeur" | "cles_max" | "total_max" | "debit";

export const MESSAGE_STOCKAGE: Record<RefusStockage, string> = {
  requete: "Requête de stockage illisible.",
  cle: `Clé invalide (1 à ${CLE_MAX} caractères).`,
  valeur: `Valeur trop grande (${VALEUR_MAX / 1000} Ko au plus).`,
  cles_max: `Trop de données dans cette page (${CLES_MAX} clés au plus).`,
  total_max: `Trop de données dans cette page (${TOTAL_MAX / 1_000_000} Mo au plus).`,
  debit: "Trop d'écritures en peu de temps : réessayez dans une minute.",
};

/** Lit une demande venue du navigateur ; `null` si elle n'a pas la bonne forme. */
export function lireDemandeStockage(brut: unknown): DemandeStockage | RefusStockage {
  const d = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const op = d.op;
  if (op !== "get" && op !== "set" && op !== "delete" && op !== "list") return "requete";
  if (op === "list") {
    const prefixe = typeof d.prefixe === "string" ? d.prefixe : "";
    if (prefixe.length > CLE_MAX) return "cle";
    return { op, prefixe };
  }
  const cle = typeof d.cle === "string" ? d.cle : "";
  if (!cle || cle.length > CLE_MAX) return "cle";
  if (op !== "set") return { op, cle };
  // Claude stocke des chaînes (JSON) : une autre valeur est sérialisée.
  const valeur = typeof d.valeur === "string" ? d.valeur : JSON.stringify(d.valeur ?? null);
  if (valeur.length > VALEUR_MAX) return "valeur";
  return { op, cle, valeur };
}

/**
 * Une écriture tient-elle dans les bornes de la page ? `existantes` : taille
 * de chaque clé déjà stockée.
 */
export function ecritureAdmise(existantes: ReadonlyMap<string, number>, cle: string, taille: number): RefusStockage | null {
  const nouvelle = !existantes.has(cle);
  if (nouvelle && existantes.size >= CLES_MAX) return "cles_max";
  let total = taille;
  for (const [c, t] of Array.from(existantes)) if (c !== cle) total += t;
  return total > TOTAL_MAX ? "total_max" : null;
}

/** Débit d'écriture par lien, en mémoire du serveur (au mieux : une instance n'en voit qu'une part). */
export function debitAdmis(horodatages: number[], maintenant: number, max = ECRITURES_PAR_MINUTE): { admis: boolean; restants: number[] } {
  const recents = horodatages.filter((t) => maintenant - t < 60_000);
  if (recents.length >= max) return { admis: false, restants: recents };
  return { admis: true, restants: [...recents, maintenant] };
}
