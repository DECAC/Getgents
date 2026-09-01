/**
 * Appels à /api/* depuis le navigateur.
 *
 * Remplace `lib/appAccess.ts` et son secret d'instance stocké en localStorage.
 * L'identité voyage maintenant dans le cookie de session Supabase, posé par la
 * bibliothèque d'authentification et transmis grâce à `credentials: "include"`.
 *
 * Un 401 ne veut plus dire « il manque la clé d'accès » mais « la session a
 * expiré » : ce n'est plus quelque chose que l'utilisateur peut corriger en
 * collant un secret, c'est un retour à la connexion.
 */

export const SESSION_EXPIREE = "session_expiree";

export function apiFetchInit(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: "include" };
}

/** Vrai si la réponse dit que la session n'est plus valable. */
export function estSessionExpiree(status: number): boolean {
  return status === 401;
}

/**
 * Signale à l'application que la session est tombée. Un événement plutôt qu'une
 * redirection directe : les modules de stockage ne connaissent pas le routeur,
 * et c'est à l'interface de décider quoi faire (purger, prévenir, rediriger).
 */
export function signalerSessionExpiree(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIREE));
}
