import type { MetadataRoute } from "next";
import { listerAnnuaire } from "@/lib/server/publicGent";

/**
 * Plan du site : les gents publics, et rien d'autre.
 *
 * `force-dynamic` parce que la liste change à chaque publication. Un plan mis
 * en cache annoncerait aux moteurs des gents dépubliés, et tairait les
 * nouveaux — l'inverse de ce qu'on attend de lui.
 */
export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const gents = await listerAnnuaire(1000).catch(() => []);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/annuaire`, changeFrequency: "daily", priority: 0.8 },
    ...gents.map((g) => ({
      url: `${base}/${g.slug}`,
      lastModified: g.publieLe ? new Date(g.publieLe) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
