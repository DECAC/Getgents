/** @type {import('next').NextConfig} */

/**
 * En-têtes durcissants appliqués à toutes les pages.
 *
 * La CSP est volontairement en `Report-Only` : Next 14 injecte des scripts
 * inline (hydratation, flight data), donc une `script-src` bloquante sans
 * nonce propagé depuis le middleware casserait l'application entière. On
 * observe d'abord, on bascule ensuite — annoncer une CSP qui ne protège rien
 * serait pire que de ne pas en avoir, mais la poser en bloquant à l'aveugle
 * mettrait le site à terre.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // 'unsafe-inline' est ce que la bascule en bloquant devra retirer, via nonce.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Les polices de l'application viennent de Google Fonts (voir app/layout.tsx) :
  // sans ces deux sources, le passage en mode bloquant casserait la typographie
  // du site entier. Constaté au navigateur, la CSP en Report-Only les refusant.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Fond de carte IGN, tuiles, et flux SSE de l'application.
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
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
        // Pages ouvertes par un lien de partage : elles ont vocation à être
        // intégrées dans un site tiers. `frame-ancestors *` l'autorise
        // explicitement — sans cette déclaration, un proxy, un CDN ou une
        // configuration d'hébergeur peut imposer un X-Frame-Options par
        // défaut, et l'iframe reste alors vide chez l'intégrateur sans
        // message d'erreur exploitable.
        source: "/l/:token",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        // Le reste de l'application (studio, espaces du créateur) n'a aucune
        // raison d'être encadré : le refuser protège du détournement de clic.
        source: "/((?!l/).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
