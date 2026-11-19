import { PleinEcran } from "@/components/pages/PleinEcran";

export const dynamic = "force-dynamic";

export const metadata = { title: "Plein écran · Getgents Pages" };

/**
 * La page en plein écran, pour son auteur. Le lien ouvrait le DOCUMENT
 * lui-même (`/api/pages/<id>/apercu`), redirigé vers le domaine de contenu :
 * sur un réseau qui ne joint pas ce domaine, « Ce site est inaccessible »
 * (vécu le 19/11). Ici, le même cadre que la fiche, avec son repli.
 */
export default async function PleinEcranPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <PleinEcran id={id} />;
}
