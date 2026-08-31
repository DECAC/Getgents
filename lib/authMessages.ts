/**
 * Messages d'authentification en français, et surtout : messages qui ne
 * RENSEIGNENT PAS l'attaquant.
 *
 * Supabase distingue « mot de passe invalide » de « utilisateur inconnu ».
 * Relayer cette distinction offre un oracle d'énumération : on découvre quelles
 * adresses ont un compte en essayant. Les deux cas reçoivent donc la même
 * réponse — celle qui aide la personne légitime sans instruire les autres.
 *
 * Module PUR, testable.
 */

export function messageErreurAuth(brut: string | undefined): string {
  const m = (brut ?? "").toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Adresse e-mail ou mot de passe incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Votre adresse n'est pas encore confirmée. Ouvrez le lien reçu par e-mail, ou demandez-en un nouveau.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    // Même réponse que pour une inscription réussie côté écran : voir
    // `MESSAGE_INSCRIPTION`. Ici, c'est le cas où Supabase le dit quand même.
    return "Si cette adresse n'a pas encore de compte, vous recevrez un e-mail de confirmation.";
  }
  if (m.includes("password") && (m.includes("short") || m.includes("least"))) {
    return "Mot de passe trop court : 8 caractères au minimum.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  }
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) {
    return "Ce lien n'est plus valable. Demandez-en un nouveau.";
  }
  return brut?.trim() || "Une erreur est survenue. Réessayez dans un instant.";
}

/**
 * Réponse à une inscription — volontairement identique que l'adresse soit
 * déjà prise ou non.
 */
export const MESSAGE_INSCRIPTION =
  "Si cette adresse n'a pas encore de compte, un e-mail de confirmation vient d'être envoyé. " +
  "Ouvrez le lien qu'il contient pour activer votre compte.";

/** Idem pour la réinitialisation : ne pas révéler qui est inscrit. */
export const MESSAGE_MOT_DE_PASSE_OUBLIE =
  "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.";

export const LONGUEUR_MOT_DE_PASSE_MIN = 8;

export function verifierMotDePasse(mdp: string, confirmation?: string): string | null {
  if (mdp.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    return `Mot de passe trop court : ${LONGUEUR_MOT_DE_PASSE_MIN} caractères au minimum.`;
  }
  if (confirmation !== undefined && mdp !== confirmation) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}

/**
 * Destination après connexion. Le paramètre `next` vient de l'URL, donc de
 * l'extérieur : n'accepter qu'un chemin interne, sinon le lien de connexion
 * devient une redirection ouverte vers le site d'un tiers, très commode pour
 * un hameçonnage qui commence sur le vrai domaine.
 */
export function destinationApresConnexion(next: string | null | undefined): string {
  if (!next) return "/builder/mesgents";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/builder/mesgents";
  }
  return next;
}
