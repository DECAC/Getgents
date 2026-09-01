import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_ACCESS_COOKIE } from "@/lib/appAccessConstants";
import { createAuthClient } from "@/lib/server/supabaseAuth";
import { isAuthConfigured } from "@/lib/authConfig";

/**
 * Rafraîchit la session et garde les pages privées.
 *
 * Ce que ce fichier faisait AVANT : il posait, sans aucune condition, un
 * cookie contenant la valeur littérale de APP_ACCESS_SECRET chez tout
 * visiteur de `/`, `/builder` ou `/espace`. Autrement dit il distribuait à
 * chaque passant la clé censée protéger les routes de données. Ce secret
 * partagé a disparu : chaque route vérifie maintenant le propriétaire.
 *
 * Deux tâches, désormais :
 *   1. rafraîchir le jeton Supabase — sans quoi la session expire au bout
 *      d'une heure en navigation, sans message ;
 *   2. rediriger vers /connexion les pages qui exigent un compte.
 *
 * Il n'est PAS la seule garde : il ne protège que des pages. Chaque route API
 * garde la sienne.
 */

/** Chemins qui exigent un compte. Le reste est public ou porte sa propre garde. */
const CHEMINS_PRIVES = [/^\/builder(\/|$)/, /^\/espace(\/|$)/, /^\/accueil$/, /^\/compte(\/|$)/];

function estPrive(pathname: string): boolean {
  return CHEMINS_PRIVES.some((re) => re.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // La réponse est créée AVANT le client Supabase, et c'est elle qui est
  // renvoyée : la bibliothèque y réécrit les cookies de session rafraîchis.
  // En construire une seconde après coup déconnecterait l'utilisateur toutes
  // les heures, sans erreur visible — c'est le piège classique de @supabase/ssr.
  let response = NextResponse.next({ request });

  if (!isAuthConfigured()) {
    // Développement local sans Supabase : mode maquette, on ne redirige pas.
    return response;
  }

  const client = createAuthClient({
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }
    },
  });

  const user = client ? (await client.auth.getUser()).data.user : null;

  if (!user && estPrive(pathname)) {
    const connexion = request.nextUrl.clone();
    connexion.pathname = "/connexion";
    connexion.search = "";
    // Où revenir après la connexion : sans ça, un lien reçu par e-mail
    // renvoie systématiquement à l'accueil, et l'intention est perdue.
    connexion.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(connexion);
  }

  // Le secret d'instance n'existe plus : les routes de données contrôlent
  // désormais le PROPRIÉTAIRE de chaque gent. Le cookie ayant été distribué à
  // tous les visiteurs pendant la vie du prototype, on l'efface activement
  // chez ceux qui le portent encore — il ne donne plus rien, mais il n'a
  // aucune raison de traîner dans les navigateurs.
  if (request.cookies.get(APP_ACCESS_COOKIE)) {
    response.cookies.set(APP_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les pages sauf : les liens de partage (/l/<token>, qui portent
     * leur propre authentification), les routes API (gardées une par une),
     * et les ressources statiques.
     */
    "/((?!l/|api/|_next/static|_next/image|favicon.ico|pdfjs/).*)",
  ],
};
