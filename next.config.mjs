/** @type {import('next').NextConfig} */

/**
 * En-têtes durcissants appliqués à toutes les réponses.
 *
 * La politique de sécurité du contenu N'EST PLUS ICI : elle porte désormais
 * un nonce propre à chaque requête, ce qu'un en-tête statique ne peut pas
 * faire. Elle est posée par `middleware.ts`, à partir de `lib/csp.ts`.
 *
 * Et elle doit y rester SEULE. Deux en-têtes `Content-Security-Policy` sur une
 * même réponse ne s'additionnent pas : le navigateur applique leur
 * intersection. Une seconde politique déclarée ici annulerait donc en silence
 * le `frame-ancestors *` des liens de partage, et l'iframe resterait vide chez
 * l'intégrateur sans le moindre message d'erreur.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Caméra et micro : notre origine seulement — le prompteur filme et suit
  // la voix. Ils étaient interdits partout (`camera=()`) : getUserMedia
  // échouait avant même de demander l'accord de l'utilisateur.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Domaine de contenu des pages partagées (`lib/domaineContenu.ts`). Lu À LA
 * CONSTRUCTION : le régler sur Vercel exige un redéploiement. Sur ce domaine,
 * toute adresse hors `/api/contenu/` (pages, autres routes API, fichiers) est
 * réécrite vers une réponse 404 : il ne sert que des documents signés. Le
 * middleware ferme aussi les pages, au cas où.
 */
const DOMAINE_CONTENU = (process.env.DOMAINE_CONTENU ?? "")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "")
  .replace(/:\d+$/, "");

const nextConfig = {
  reactStrictMode: true,
  // Aucune page n'utilise `next/image`. Couper l'optimiseur ferme
  // `/_next/image`, visé par un avis de sécurité (déni de service) qui ne
  // touche QUE l'auto-hébergement — préalable à la sortie de Vercel.
  images: { unoptimized: true },
  async rewrites() {
    if (!DOMAINE_CONTENU) return [];
    return {
      beforeFiles: [
        {
          source: "/:chemin((?!api/contenu/).*)",
          // La valeur est une expression régulière : les points sont échappés.
          has: [{ type: "host", value: DOMAINE_CONTENU.replace(/\./g, "\\.") }],
          destination: "/api/contenu/introuvable",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // `frame-ancestors` de la CSP fait le vrai travail, y compris
        // l'autorisation d'encadrement des liens de partage. `X-Frame-Options`
        // reste pour les navigateurs qui l'ignorent, et se limite donc aux
        // pages qui ne doivent JAMAIS être encadrées — l'en-tête ne connaît
        // pas de variante « partout sauf ici ».
        // Les documents du domaine de contenu sont encadrés par getgents.ai :
        // leur `frame-ancestors` le dit, `SAMEORIGIN` le contredirait.
        source: "/((?!l/|api/contenu/).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
