import { APP_ACCESS_COOKIE, APP_ACCESS_HEADER } from "@/lib/appAccessConstants";

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
export { APP_ACCESS_HEADER, APP_ACCESS_COOKIE };

export function isAppAccessEnforced(): boolean {
  return !!process.env.APP_ACCESS_SECRET;
}

function cookieSecret(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|;\\s*)${APP_ACCESS_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function checkAppAccess(req: Request): boolean {
  const secret = process.env.APP_ACCESS_SECRET;
  if (!secret) return true; // non configuré → pas de protection (dev)
  const header = req.headers.get(APP_ACCESS_HEADER);
  if (header && header === secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (cookieSecret(req) === secret) return true;
  return false;
}

/**
 * Explication actionnable jointe aux refus 401 : « unauthorized » seul ne dit
 * pas au créateur quoi faire, alors que la cause est presque toujours la même —
 * APP_ACCESS_SECRET est configuré côté serveur mais le navigateur ne l'a pas
 * encore (cookie posé par le middleware sur /builder et /espace, ou ?key=…).
 */
export const APP_ACCESS_HINT =
  "Accès protégé par APP_ACCESS_SECRET : ce navigateur n'a pas encore la clé. " +
  "Ouvrez l'application depuis /builder ou /espace (la clé est posée automatiquement en production), " +
  "ou une fois avec ?key=VOTRE_SECRET dans l'URL (mémorisée en local).";
