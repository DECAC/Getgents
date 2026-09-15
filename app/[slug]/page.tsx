import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lireGentPublic, tokenConversationPublique } from "@/lib/server/publicGent";
import { slugProbleme } from "@/lib/slug";
import { SharedGentShell } from "@/components/shared-link/SharedGentShell";
import { GentPublicVitrine } from "@/components/public/GentPublicVitrine";
import { headers } from "next/headers";

/**
 * Page publique d'un gent : `getgents.ai/<slug>`.
 *
 * À la racine du domaine, donc en concurrence avec les routes de
 * l'application. Next donne la priorité aux routes statiques (`/builder`,
 * `/compte`…), et `lib/slug.ts` interdit d'attribuer ces noms — sans cela un
 * gent nommé « builder » serait publié sans être joignable, et son créateur
 * n'en saurait rien.
 *
 * Rendue côté serveur, avec ses métadonnées : c'est ce qui la rend
 * indexable par les moteurs de recherche.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: { slug: string };
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (slugProbleme(params.slug)) return { title: "Page introuvable" };

  const gent = await lireGentPublic(params.slug);
  if (!gent) return { title: "Page introuvable", robots: { index: false } };

  const nom = gent.espace.name || "Gent";
  const description =
    gent.resume ||
    gent.espace.gent ||
    `${nom} — un assistant créé sur Getgents, disponible en libre accès.`;
  const url = `${baseUrl()}/${gent.slug}`;

  return {
    title: `${nom} · Getgents`,
    description: description.slice(0, 300),
    // Canonique explicite : le même gent peut être atteint par un lien de
    // partage, et deux adresses pour un même contenu diluent le référencement.
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Getgents",
      title: nom,
      description: description.slice(0, 300),
    },
    twitter: { card: "summary", title: nom, description: description.slice(0, 200) },
    robots: { index: true, follow: true },
  };
}

export default async function GentPublicPage({ params }: Props) {
  if (slugProbleme(params.slug)) notFound();

  const gent = await lireGentPublic(params.slug);
  if (!gent) notFound();

  const token = gent.chatOuvert ? await tokenConversationPublique(gent.id, gent.slug) : null;

  // Données structurées : elles décrivent la page aux moteurs dans un format
  // qu'ils lisent sans avoir à deviner.
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: gent.espace.name,
    applicationCategory: "BusinessApplication",
    description: gent.resume ?? gent.espace.gent ?? undefined,
    url: `${baseUrl()}/${gent.slug}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Sans nonce, notre propre politique bloquerait ce bloc : les
        // navigateurs appliquent `script-src` à toute balise <script>, même
        // celles qui ne contiennent pas de code exécutable. Le gent
        // disparaîtrait alors des résultats enrichis de Google.
        nonce={headers().get("x-nonce") ?? undefined}
        // Contenu construit par nous à partir de champs déjà projetés par la
        // liste blanche publique : aucune donnée du créateur n'y transite.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />
      {token ? (
        <SharedGentShell token={token} espace={gent.espace} />
      ) : (
        <GentPublicVitrine gent={gent} />
      )}
    </>
  );
}
