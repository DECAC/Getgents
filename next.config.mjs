/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
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
