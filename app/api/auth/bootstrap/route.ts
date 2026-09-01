import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { claimOrphanGentsOnce, sealGrantsForUser } from "@/lib/server/claimOrphans";

/**
 * Appelée après chaque connexion réussie.
 *
 * Pourquoi une route dédiée plutôt qu'un simple appel dans /auth/callback :
 * ce dernier n'est traversé que par les liens reçus par e-mail. Quelqu'un qui
 * se connecte par mot de passe ne le voit jamais, et la reprise n'aurait
 * jamais lieu. L'opération étant idempotente, l'appeler à chaque connexion ne
 * coûte qu'un aller-retour et ne fait rien les fois suivantes.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const resultat = await claimOrphanGentsOnce(auth.user.id);
  // Invitations reçues avant l'inscription : elles visaient l'adresse, elles
  // s'attachent maintenant au compte.
  const scellees = await sealGrantsForUser(auth.user.id, auth.user.confirmedEmail);
  return NextResponse.json({ ...resultat, invitationsScellees: scellees });
}
