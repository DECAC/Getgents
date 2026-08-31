/**
 * Qui a le droit de faire quoi sur un gent.
 *
 * Toute l'autorisation de la plateforme se ramène à cette fonction, isolée du
 * réseau et de la base pour être testable exhaustivement. Les routes en
 * dépendent, elles ne redécident rien.
 */

export type GentRole = "owner" | "editor" | "viewer" | "none";

export type GentVisibility = "private" | "shared" | "public";

/** Ce qu'une invitation nominative accorde, une fois scellée sur un compte. */
export interface GentGrant {
  granteeId: string | null;
  invitedEmail: string;
  role: "viewer" | "editor";
  revokedAt: string | null;
}

export interface GentAccessInput {
  ownerId: string | null;
  visibility: GentVisibility;
  grants: GentGrant[];
  /** Utilisateur connecté, ou null pour un visiteur anonyme. */
  userId: string | null;
  /** Adresse du compte connecté, en minuscules — voir la note sur le scellement. */
  userEmail: string | null;
}

export function resolveAccess(input: GentAccessInput): GentRole {
  const { ownerId, visibility, grants, userId, userEmail } = input;

  if (userId && ownerId && userId === ownerId) return "owner";

  const active = grants.filter((g) => !g.revokedAt);

  // Invitation scellée : l'accès est attaché au compte.
  if (userId) {
    const sealed = active.find((g) => g.granteeId === userId);
    if (sealed) return sealed.role;
  }

  // Invitation en attente : l'accès est reconnu à l'ADRESSE, tant que
  // personne ne l'a réclamée. C'est ce qui permet à un invité de voir le gent
  // dès sa première connexion, avant même que le scellement ait eu lieu.
  // Il faut une adresse CONFIRMÉE côté appelant : `userEmail` ne doit être
  // renseigné que pour un compte dont l'e-mail est vérifié, sans quoi
  // s'inscrire avec l'adresse d'autrui suffirait à hériter de ses accès.
  if (userEmail) {
    const pending = active.find((g) => g.granteeId === null && g.invitedEmail === userEmail);
    if (pending) return pending.role;
  }

  // Un gent public se lit par tout le monde, y compris sans compte — mais en
  // lecture seule, et à travers la projection publique de l'espace.
  if (visibility === "public") return "viewer";

  return "none";
}

export function canRead(role: GentRole): boolean {
  return role !== "none";
}

/** Modifier le contenu d'un gent : propriétaire et co-éditeurs. */
export function canWrite(role: GentRole): boolean {
  return role === "owner" || role === "editor";
}

/**
 * Supprimer, partager, publier, révoquer : réservé au propriétaire. Un
 * co-éditeur travaille sur le gent, il n'en dispose pas.
 */
export function canAdminister(role: GentRole): boolean {
  return role === "owner";
}
