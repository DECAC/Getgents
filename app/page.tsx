import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured } from "@/lib/authConfig";
import { VitrinePages } from "@/components/public/VitrinePages";
import { etatInscriptions } from "@/lib/server/inscriptions";

/**
 * Racine du site : la vitrine de Getgents Pages (18/11), seul produit ouvert
 * au public. Un compte connecté va à son accueil — `/accueil`, que le
 * middleware renvoie vers `/pages` pour un compte « pages ».
 */
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "Ce que vous créez avec l'IA, envoyé à la bonne personne, par un lien privé : un assistant répond à ses questions, et vous voyez quand la page est ouverte.";

export const metadata: Metadata = {
  title: "Getgents Pages — vos documents IA, partagés par un lien privé",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Getgents Pages", description: DESCRIPTION, type: "website", locale: "fr_FR" },
};

export default async function Home() {
  // Sans Supabase (développement local), pas de session : la vitrine.
  if (!isAuthConfigured()) return <VitrinePages inscriptions={await etatInscriptions()} />;

  const user = await getUser();
  if (user) redirect("/accueil");

  return <VitrinePages inscriptions={await etatInscriptions()} />;
}
