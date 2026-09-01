import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/server/supabaseAuth";
import { destinationApresConnexion } from "@/lib/authMessages";
import { claimOrphanGentsOnce, sealGrantsForUser } from "@/lib/server/claimOrphans";

/**
 * Atterrissage des liens envoyés par e-mail (confirmation d'inscription,
 * réinitialisation de mot de passe).
 *
 * Un route handler, et non une page : c'est le seul endroit — avec le
 * middleware — où Next autorise l'écriture de cookies, et l'échange du code
 * contre une session en pose plusieurs. Le faire dans un composant serveur
 * échouerait silencieusement, laissant l'utilisateur « connecté » d'un côté
 * et anonyme de l'autre.
 *
 * C'est aussi ici qu'a lieu la reprise des gents d'avant les comptes. Le
 * scellement des invitations reçues viendra avec le partage nominatif.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = destinationApresConnexion(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/confirmation?erreur=1", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));

  const client = createAuthClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        response.cookies.set(name, value, options);
      }
    },
  });

  if (!client) {
    return NextResponse.redirect(new URL("/confirmation?erreur=1", url.origin));
  }

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    // Lien expiré ou déjà utilisé : l'écran de confirmation explique quoi faire.
    return NextResponse.redirect(new URL("/confirmation?erreur=1", url.origin));
  }

  // Reprise des gents d'avant les comptes, au tout premier compte créé.
  // Un échec ici ne doit jamais empêcher la connexion : il est journalisé
  // par claimOrphanGentsOnce, et la prochaine connexion réessaiera.
  if (data.user) {
    await claimOrphanGentsOnce(data.user.id);
    const emailConfirme = data.user.email_confirmed_at
      ? (data.user.email ?? "").toLowerCase() || null
      : null;
    await sealGrantsForUser(data.user.id, emailConfirme);
  }

  return response;
}
