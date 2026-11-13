import { PagesShell } from "@/components/pages/PagesShell";
import { FichePage } from "@/components/pages/FichePage";
import { offreDuDemandeur } from "@/lib/server/offre";

export const dynamic = "force-dynamic";

export const metadata = { title: "Page · GetSite" };

/** La fiche d'une page : aperçu, destinataires, assistant, versions. */
export default async function FichePagePage({ params }: { params: { id: string } }) {
  const { offre } = await offreDuDemandeur();
  return (
    <PagesShell offre={offre}>
      <FichePage id={params.id} />
    </PagesShell>
  );
}
