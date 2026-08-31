import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/server/supabaseAuth";
import { destinationApresConnexion } from "@/lib/authMessages";

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
 * C'est aussi ici que viendront, au lot suivant, la reprise des gents
 * orphelins et le scellement des invitations reçues.
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

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    // Lien expiré ou déjà utilisé : l'écran de confirmation explique quoi faire.
    return NextResponse.redirect(new URL("/confirmation?erreur=1", url.origin));
  }

  return response;
}
