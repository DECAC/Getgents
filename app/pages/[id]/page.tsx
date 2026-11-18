import { PagesShell } from "@/components/pages/PagesShell";
import { FichePage } from "@/components/pages/FichePage";
import { offreDuDemandeur } from "@/lib/server/offre";

export const dynamic = "force-dynamic";

export const metadata = { title: "Page · GetSite" };

/** La fiche d'une page : aperçu, destinataires, assistant, versions. */
export default async function FichePagePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { offre } = await offreDuDemandeur();
  return (
    <PagesShell offre={offre}>
      <FichePage id={params.id} />
    </PagesShell>
  );
}
