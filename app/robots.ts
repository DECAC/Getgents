import type { MetadataRoute } from "next";

/**
 * Ce que les moteurs ont le droit d'explorer.
 *
 * Les pages de gents publics sont à la racine et doivent être indexées : c'est
 * tout l'intérêt d'une adresse `getgents.ai/<nom>`. Tout le reste est fermé —
 * le studio et les espaces sont privés de toute façon, mais un lien de partage
 * `/l/<jeton>` n'a pas vocation à finir dans un index public : son
 * destinataire l'a reçu personnellement.
 */
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/builder/", "/espace/", "/compte", "/accueil", "/l/", "/auth/", "/prototype/"],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
    host: baseUrl(),
  };
}
