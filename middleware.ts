import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_ACCESS_COOKIE } from "@/lib/appAccessConstants";
import { createAuthClient } from "@/lib/server/supabaseAuth";
import { isAuthConfigured } from "@/lib/authConfig";
import { politiqueCsp, nouveauNonce } from "@/lib/csp";

/**
 * Rafraîchit la session et garde les pages privées.
 *
 * Ce que ce fichier faisait AVANT : il posait, sans aucune condition, un
 * cookie contenant la valeur littérale de APP_ACCESS_SECRET chez tout
 * visiteur de `/`, `/builder` ou `/espace`. Autrement dit il distribuait à
 * chaque passant la clé censée protéger les routes de données. Ce secret
 * partagé a disparu : chaque route vérifie maintenant le propriétaire.
 *
 * Trois tâches, désormais :
 *   1. poser la politique de sécurité du contenu avec un nonce propre à la
 *      requête — c'est ici, et nulle part ailleurs, parce que le nonce doit
 *      changer à chaque tour et qu'un en-tête statique ne le peut pas ;
 *   2. rafraîchir le jeton Supabase — sans quoi la session expire au bout
 *      d'une heure en navigation, sans message ;
 *   3. rediriger vers /connexion les pages qui exigent un compte.
 *
 * Il n'est PAS la seule garde : il ne protège que des pages. Chaque route API
 * garde la sienne.
 */

/**
 * Chemins qui exigent un compte. Le reste est public ou porte sa propre garde.
 *
 * Les gents publics vivent à la RACINE (`/mon-gent`) : la liste est donc une
 * liste de ce qui est FERMÉ, jamais l'inverse. Fermer par défaut renverrait
 * chaque visiteur d'un gent public vers l'écran de connexion — et le moteur
 * de recherche avec lui.
 */
const CHEMINS_PRIVES = [/^\/builder(\/|$)/, /^\/espace(\/|$)/, /^\/accueil$/, /^\/compte(\/|$)/];

function estPrive(pathname: string): boolean {
  return CHEMINS_PRIVES.some((re) => re.test(pathname));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Le nonce doit atteindre DEUX destinataires :
   *
   *   - le navigateur, par l'en-tête de réponse, qui lui dit quels scripts
   *     ont le droit de s'exécuter ;
   *   - le rendu de Next, par un en-tête de REQUÊTE, sans quoi ses propres
   *     balises <script> n'en porteraient aucun et la page entière serait
   *     bloquée par sa propre politique.
   *
   * Next lit la politique sur la requête et en extrait le nonce lui-même :
   * c'est pour cela qu'on la pose des deux côtés, et non par oubli.
   */
  const nonce = nouveauNonce();
  // Les liens de partage ont vocation à être intégrés chez un tiers.
  const encadrable = pathname.startsWith("/l/");
  const csp = politiqueCsp({ nonce, encadrable });

  const enTetes = new Headers(request.headers);
  enTetes.set("x-nonce", nonce);
  enTetes.set("Content-Security-Policy", csp);

  const avecCsp = (r: NextResponse) => {
    r.headers.set("Content-Security-Policy", csp);
    return r;
  };

  // La réponse est créée AVANT le client Supabase, et c'est elle qui est
  // renvoyée : la bibliothèque y réécrit les cookies de session rafraîchis.
  // En construire une seconde après coup déconnecterait l'utilisateur toutes
  // les heures, sans erreur visible — c'est le piège classique de @supabase/ssr.
  let response = NextResponse.next({ request: { headers: enTetes } });

  // Un lien de partage porte sa propre authentification, par jeton : il n'a
  // pas de session à rafraîchir, et interroger Supabase pour chaque visiteur
  // anonyme coûterait un aller-retour sans rien apporter.
  if (encadrable) return avecCsp(response);

  if (!isAuthConfigured()) {
    // Développement local sans Supabase : mode maquette, on ne redirige pas.
    return avecCsp(response);
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
    return avecCsp(NextResponse.redirect(connexion));
  }

  // Le secret d'instance n'existe plus : les routes de données contrôlent
  // désormais le PROPRIÉTAIRE de chaque gent. Le cookie ayant été distribué à
  // tous les visiteurs pendant la vie du prototype, on l'efface activement
  // chez ceux qui le portent encore — il ne donne plus rien, mais il n'a
  // aucune raison de traîner dans les navigateurs.
  if (request.cookies.get(APP_ACCESS_COOKIE)) {
    response.cookies.set(APP_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return avecCsp(response);
}

export const config = {
  matcher: [
    /*
     * Toutes les pages, y compris les liens de partage : ils ne demandent
     * aucune session, mais ils ont besoin d'un nonce comme les autres — les
     * exclure les aurait laissés sans politique, donc sans protection, sur
     * les seules pages qu'on ouvre à des inconnus.
     *
     * Restent dehors : les routes API (qui répondent du JSON, où la politique
     * n'a pas d'objet, et qui portent chacune sa garde) et les ressources
     * statiques.
     */
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|pdfjs/).*)",
  ],
};
