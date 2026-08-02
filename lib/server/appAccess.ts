/**
 * Garde d'accès aux routes qui exposent le contenu des espaces (/api/gents*).
 *
 * Sans elle, `GET /api/gents` renvoie tous les espaces publiés — prompts
 * système, documents fournis par l'utilisateur (CV…), conversations — à
 * n'importe quel appelant. Le RLS de la table ne protège que les clés anon :
 * ces routes utilisent la clé service_role, qui le contourne.
 *
 * Même convention que `checkCronSecret` (app/api/routines/run) : si la variable
 * n'est pas configurée, la garde laisse passer, pour ne pas casser le
 * développement local ni une instance existante. En déploiement public,
 * APP_ACCESS_SECRET doit être défini.
 *
 * Les routes de partage (/api/links/[token]/*) ne passent PAS par cette garde :
 * elles sont destinées au destinataire d'un lien et portent leur propre
 * authentification, le token.
 */
export const APP_ACCESS_HEADER = "x-app-secret";

export function isAppAccessEnforced(): boolean {
  return !!process.env.APP_ACCESS_SECRET;
}

export function checkAppAccess(req: Request): boolean {
  const secret = process.env.APP_ACCESS_SECRET;
  if (!secret) return true; // non configuré → pas de protection (dev)
  const header = req.headers.get(APP_ACCESS_HEADER);
  if (header && header === secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Explication actionnable jointe aux refus 401 : « unauthorized » seul ne dit
 * pas au créateur quoi faire, alors que la cause est presque toujours la même —
 * APP_ACCESS_SECRET est configuré côté serveur mais le navigateur ne l'a jamais
 * reçu (voir lib/appAccess.ts : capture unique via ?key=…).
 */
export const APP_ACCESS_HINT =
  "Accès protégé par APP_ACCESS_SECRET : ce navigateur n'a pas encore la clé. " +
  "Rouvrez l'application une fois avec ?key=VOTRE_SECRET dans l'URL (elle est mémorisée puis retirée de la barre d'adresse).";

