import { PagesShell } from "@/components/pages/PagesShell";
import { FichePage } from "@/components/pages/FichePage";

export const metadata = { title: "Page · GetSite" };

/** La fiche d'une page : aperçu, destinataires, assistant, versions. */
export default function FichePagePage({ params }: { params: { id: string } }) {
  return (
    <PagesShell>
      <FichePage id={params.id} />
    </PagesShell>
  );
}
