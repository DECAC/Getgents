/**
 * Quand cesser d'offrir des outils au modèle, et le forcer à RÉPONDRE.
 *
 * La route de conversation meurt à 300 s (`maxDuration`, plan Vercel Pro).
 * Un gent qui enchaîne les appels (Gmail : lister, lire, relire…) pouvait
 * consommer tout ce temps en outils : la fonction était tuée avant que le
 * modèle n'écrive un mot, et le visiteur voyait les intégrations défiler
 * puis… rien. Passé ce budget, le tour suivant se fait SANS outils : le modèle
 * rédige avec ce qu'il a déjà obtenu, en gardant le temps d'écrire.
 *
 * Module PUR.
 */
/**
 * 8 tours, contre 6 : un bilan sur trois expéditeurs a consommé les six
 * (1 recherche, 3 recherches, 3 lectures, 2 lectures, 1 recherche, rédaction)
 * en 38 s. Le budget de TEMPS protège déjà de la coupure à 300 s ; la limite
 * de tours n'a plus à le faire, elle ne doit qu'empêcher une boucle sans fin.
 */
export const MAX_TOURS_OUTILS = 8;

/** Temps laissé aux outils ; le reste (≈ 130 s) sert à rédiger la réponse. */
export const BUDGET_OUTILS_MS = 170_000;

export function outilsEncoreAutorises(tour: number, ecouleMs: number): boolean {
  return tour < MAX_TOURS_OUTILS - 1 && ecouleMs < BUDGET_OUTILS_MS;
}

/**
 * Joint au tour où les outils sont RETIRÉS. Vécu : le modèle, qui appelait
 * Gmail depuis cinq tours, a reçu un tour sans outils et sans explication —
 * il a rendu une réponse VIDE (`finishReason: stop`, 0 caractère). Sans
 * consigne, retirer les outils ne dit pas qu'il faut conclure.
 */
export const CONSIGNE_DERNIER_TOUR =
  "[SYSTÈME] Plus aucun outil n'est disponible pour cette réponse. Rédige MAINTENANT ta réponse finale à " +
  "l'utilisateur à partir des résultats déjà obtenus, et signale en une phrase ce que tu n'as pas pu vérifier.";

/**
 * Dit à l'utilisateur que la réponse finale manque, même si une phrase
 * d'attente (« je cherche aussi… ») est déjà partie : sans ce message, il
 * restait devant cette phrase, sans suite.
 */
export const MESSAGE_REPONSE_FINALE_MANQUANTE =
  "Je n'ai pas réussi à rédiger la réponse finale après mes recherches. Réessayez, ou restreignez la demande " +
  "(moins d'expéditeurs, période plus courte).";
