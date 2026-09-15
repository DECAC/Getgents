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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
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
        source: "/((?!l/).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
