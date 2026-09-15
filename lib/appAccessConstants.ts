/**
 * Nom du cookie de l'ancien secret d'instance.
 *
 * Le secret lui-même n'existe plus : les routes de données contrôlent le
 * propriétaire de chaque gent. Ce nom subsiste le temps que le middleware
 * efface le cookie chez les visiteurs qui le portent encore — il ne donne
 * plus accès à rien, mais il n'a rien à faire dans un navigateur. À
 * supprimer, avec l'effacement, dans quelques semaines.
 */
export const APP_ACCESS_COOKIE = "getgents-app-secret";
