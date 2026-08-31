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
 * chaque passant la clé censée protéger les routes de données. Ce n'est plus
 * le cas : la clé n'est posée que pour une session vérifiée.
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

  const secret = process.env.APP_ACCESS_SECRET?.trim();
  if (secret && user) {
    // Mesure de transition : les routes /api/gents* et /api/drafts* vérifient
    // encore ce secret partagé. Il n'est plus donné qu'à une session vérifiée
    // — la faille est fermée — mais il ne cloisonne toujours pas les comptes
    // entre eux. Ce cookie disparaît avec `checkAppAccess`, remplacé par le
    // contrôle de propriétaire.
    if (request.cookies.get(APP_ACCESS_COOKIE)?.value !== secret) {
      response.cookies.set(APP_ACCESS_COOKIE, secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  } else if (!user && request.cookies.get(APP_ACCESS_COOKIE)) {
    // Le cookie a été distribué à tout le monde pendant la vie du prototype :
    // on l'efface activement chez les visiteurs qui le portent encore.
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
