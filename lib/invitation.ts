/**
 * Atterrissage d'un lien d'INVITATION (13/11) — offre « Getgents Pages ».
 *
 * Deux formes de lien arrivent ici :
 *   - le modèle d'e-mail RECOMMANDÉ (Supabase → Email Templates → Invite
 *     user) pointe vers `/auth/confirm?token_hash=…&type=invite` : le serveur
 *     vérifie le jeton et pose la session (route handler, cookies) ;
 *   - le modèle par DÉFAUT renvoie la session dans le FRAGMENT de l'adresse
 *     (`#access_token=…&refresh_token=…&type=invite`), que le serveur ne voit
 *     jamais : l'invité arrivait déconnecté sur l'accueil public, devant
 *     « Demander un accès ». `lireFragment` le lit dans le navigateur.
 *
 * Dans les deux cas, l'invité finit sur /bienvenue : il choisit son mot de
 * passe (il n'en a pas encore) et, s'il le veut, son nom affiché.
 *
 * Module PUR.
 */

export type TypeLien = "invite" | "recovery" | "signup" | "magiclink" | "email";

const TYPES: readonly string[] = ["invite", "recovery", "signup", "magiclink", "email"];

export function typeLienValide(t: unknown): t is TypeLien {
  return typeof t === "string" && TYPES.includes(t);
}

/** Où mène un lien vérifié. */
export function destinationDuLien(type: TypeLien): string {
  if (type === "invite") return "/bienvenue";
  if (type === "recovery") return "/nouveau-mot-de-passe";
  return "/accueil";
}

export type Fragment =
  | { genre: "session"; accessToken: string; refreshToken: string; type: TypeLien }
  | { genre: "erreur"; code: string }
  | null;

/**
 * Le fragment d'un lien Supabase. Seules une invitation et une
 * réinitialisation ouvrent une session ici : accepter n'importe quel jeton
 * dans l'adresse permettrait de connecter quelqu'un à un AUTRE compte par un
 * lien piégé.
 */
export function lireFragment(hash: string): Fragment {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const erreur = p.get("error_code") || p.get("error");
  if (erreur) return { genre: "erreur", code: erreur.slice(0, 60) };
  const accessToken = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  const type = p.get("type");
  if (!accessToken || !refreshToken || (type !== "invite" && type !== "recovery")) return null;
  return { genre: "session", accessToken, refreshToken, type };
}

/** Le message d'un lien qui n'a pas pu ouvrir de session. */
export function messageLienInvalide(code: string | null): string {
  if (code && /expired|otp_expired/i.test(code))
    return "Ce lien a expiré. Demandez une nouvelle invitation à la personne qui vous l'a envoyée, ou utilisez « Mot de passe oublié » avec votre adresse.";
  return "Ce lien n'est plus valable (il a peut-être déjà servi). Si vous avez déjà choisi un mot de passe, connectez-vous ; sinon, utilisez « Mot de passe oublié » avec votre adresse.";
}
