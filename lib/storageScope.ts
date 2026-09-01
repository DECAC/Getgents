/**
 * Cloisonnement du cache local par compte.
 *
 * Les gents et brouillons sont mis en cache dans le localStorage pour un
 * affichage instantané. Ce cache était nommé globalement
 * (`getgents:published-gents`) : sur une machine partagée, le compte suivant
 * ouvrait l'application et voyait les gents du précédent — prompts système et
 * documents de connaissance compris — avant même le premier appel au serveur.
 *
 * Deux mécanismes, tous deux nécessaires :
 *   1. les clés portent l'identifiant du compte, ce qui rend la fuite passive
 *      impossible ;
 *   2. la purge à la déconnexion efface ce qui reste sur le disque.
 *
 * Le namespace seul laisserait les données du compte précédent sur la machine.
 * La purge seule raterait le cas d'un onglet resté ouvert. D'où les deux.
 *
 * Module PUR — testable sans navigateur.
 */

export const PREFIXE = "getgents:";

/** Clés qui ne sont PAS liées à un compte : préférences d'affichage locales. */
const NON_CLOISONNEES = new Set<string>(["getgents:last-user"]);

/**
 * Clé effective pour un compte donné. Sans compte connu (mode maquette, ou
 * avant que la session soit lue), on garde la clé nue : c'est le comportement
 * d'origine, et il n'y a alors personne à cloisonner.
 */
export function scopedKey(base: string, userId: string | null): string {
  if (!userId) return base;
  const suffixe = base.startsWith(PREFIXE) ? base.slice(PREFIXE.length) : base;
  return `${PREFIXE}${userId}:${suffixe}`;
}

/** La clé appartient-elle au compte donné ? */
export function belongsTo(key: string, userId: string): boolean {
  return key.startsWith(`${PREFIXE}${userId}:`);
}

/**
 * Clés à supprimer : tout ce qui appartient à un AUTRE compte, plus les clés
 * nues héritées d'avant le cloisonnement. `userId` null (déconnexion) rend
 * tout obsolète, sauf les préférences non liées à un compte.
 */
export function staleScopedKeys(allKeys: string[], userId: string | null): string[] {
  return allKeys.filter((k) => {
    if (!k.startsWith(PREFIXE)) return false;
    if (NON_CLOISONNEES.has(k)) return false;
    if (!userId) return true;
    return !belongsTo(k, userId);
  });
}

/** Mémorise le dernier compte vu, pour détecter un changement d'utilisateur. */
export const DERNIER_COMPTE = "getgents:last-user";
