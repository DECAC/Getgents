import type { Artefact, VersionArtefact } from "@/lib/types";

/**
 * Historique des versions d'un artefact.
 *
 * Une retouche appliquée, ou une version complète qui remplace la précédente,
 * écrasait l'ancien contenu sans retour possible. Chaque changement range
 * désormais l'état PRÉCÉDENT dans `versions` (la plus récente en tête), et
 * restaurer une version est lui-même un changement : rien n'est jamais
 * détruit, on peut revenir d'une restauration.
 *
 * Module PUR.
 */

/**
 * Au-delà, l'historique pèse sur le stockage du navigateur du visiteur
 * (~5 Mo) et sur la ligne de l'espace : les plus anciennes versions tombent.
 */
export const MAX_VERSIONS = 8;

function contenuDe(a: Artefact): VersionArtefact["contenu"] {
  const { id: _id, versions: _v, ...contenu } = a;
  return contenu;
}

/** Numéro de la version courante : 1 + le nombre de versions rangées. */
export function numeroVersion(a: Artefact): number {
  return (a.versions?.[0]?.n ?? 0) + 1;
}

/**
 * `apres` remplace `avant`, qui rejoint l'historique. L'identifiant reste
 * celui d'`avant` : même onglet, même place, mêmes références.
 */
export function avecNouvelleVersion(avant: Artefact, apres: Artefact, resume: string, date: string): Artefact {
  const rangee: VersionArtefact = { n: numeroVersion(avant), date, resume, contenu: contenuDe(avant) };
  return {
    ...apres,
    id: avant.id,
    versions: [rangee, ...(avant.versions ?? [])].slice(0, MAX_VERSIONS),
  };
}

/** Revient à la version `n` — en rangeant l'état actuel, comme tout changement. */
export function restaurerVersion(a: Artefact, n: number, date: string): Artefact | null {
  const cible = a.versions?.find((v) => v.n === n);
  if (!cible) return null;
  return avecNouvelleVersion(a, { ...cible.contenu, id: a.id }, `retour à la version ${n}`, date);
}
