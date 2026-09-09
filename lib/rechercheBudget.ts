/**
 * Budget de recherche web pour UN tour de conversation.
 *
 * Mesuré en production : sans borne, un tour est parti en 150 secondes de
 * silence. Le modèle a le droit de rappeler l'outil tant qu'il n'est pas
 * satisfait, et la boucle d'outils lui offrait six tours — chacun pouvant
 * contenir une recherche sans délai maximal. Le visiteur, lui, était devant
 * un écran muet.
 *
 * Deux bornes, donc : un NOMBRE d'appels par tour, et un DÉLAI par appel.
 * Quand le budget est épuisé, on ne lève pas et on ne se tait pas : on rend au
 * modèle une phrase qu'il peut lire et relayer. Un refus explicite le fait
 * conclure ; un silence le ferait réessayer.
 *
 * Module PUR.
 */

/** Au-delà, le gain d'information ne vaut plus l'attente infligée. */
export const MAX_RECHERCHES_PAR_TOUR = 2;

/** Une recherche qui dépasse ce délai ne sauvera pas la réponse. */
export const DELAI_RECHERCHE_MS = 12_000;

export function budgetEpuise(appelsDejaFaits: number, max = MAX_RECHERCHES_PAR_TOUR): boolean {
  return appelsDejaFaits >= max;
}

/**
 * Le message rendu au modèle quand il insiste. Impératif et sans ambiguïté :
 * il doit conclure avec ce qu'il a, et le dire s'il lui manque quelque chose.
 */
export const MESSAGE_BUDGET_EPUISE =
  "Limite de recherches atteinte pour cette réponse. N'appelle plus cet outil. " +
  "Réponds maintenant avec ce que tu as, et dis franchement ce que tu n'as pas pu vérifier.";

export const MESSAGE_DELAI_DEPASSE =
  "La recherche web a été trop longue et a été interrompue. " +
  "Réponds sans elle, en signalant que tu n'as pas pu vérifier ce point.";
