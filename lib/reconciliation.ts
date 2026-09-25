/**
 * Réconciliation d'un cache local avec le serveur : qu'est-ce qu'un gent
 * présent dans CE navigateur et absent du serveur ?
 *
 * Deux réponses possibles, qu'on confondait :
 *   - créé hors ligne, jamais arrivé au serveur → à ENVOYER ;
 *   - supprimé ailleurs (autre machine, autre onglet) → à OUBLIER.
 * On envoyait tout. Vécu : Radar Emploi, Toilettes publiques… supprimés, puis
 * RECRÉÉS au serveur par le cache d'un autre navigateur à sa prochaine
 * ouverture du studio — « je pensais avoir tout nettoyé ».
 *
 * Ce qui départage : la liste des identifiants que le serveur a déjà
 * CONFIRMÉS (vus dans sa liste, ou écrits avec succès). Absent du serveur
 * après y avoir été = supprimé. Un cache d'avant cette règle n'a pas de liste
 * (`connus === null`) : tout ce qui manque au serveur y est traité comme
 * supprimé — un envoi hors ligne jamais abouti se perdrait, un fantôme ne
 * revient plus.
 */
export interface Reconciliation {
  /** Jamais vus par le serveur : créés ici, à envoyer. */
  aEnvoyer: string[];
  /** Déjà connus du serveur, qui ne les a plus : supprimés ailleurs. */
  ecartes: string[];
}

export function reconcilier(
  local: Readonly<Record<string, unknown>>,
  distant: Readonly<Record<string, unknown>>,
  connus: ReadonlySet<string> | null
): Reconciliation {
  const aEnvoyer: string[] = [];
  const ecartes: string[] = [];
  for (const id of Object.keys(local)) {
    if (id in distant) continue;
    if (connus === null || connus.has(id)) ecartes.push(id);
    else aEnvoyer.push(id);
  }
  return { aEnvoyer, ecartes };
}

// --- Liste des identifiants confirmés, par cache (clé propre au compte) ----

export function lireConnus(cle: string): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    const ids = JSON.parse(brut) as unknown;
    return Array.isArray(ids) ? new Set(ids.filter((x): x is string => typeof x === "string")) : null;
  } catch {
    return null;
  }
}

export function ecrireConnus(cle: string, ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cle, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    // Stockage plein ou interdit : la prochaine liste du serveur la refera.
  }
}

/** Un envoi vient d'aboutir : le serveur connaît désormais cet identifiant. */
export function ajouterConnu(cle: string, id: string): void {
  // Seule une LISTE du serveur crée la liste : créée ici, elle ferait passer
  // les fantômes d'un vieux cache pour des gents « jamais vus », à envoyer.
  const connus = lireConnus(cle);
  if (!connus || connus.has(id)) return;
  connus.add(id);
  ecrireConnus(cle, connus);
}
