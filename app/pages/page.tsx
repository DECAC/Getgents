import { Suspense } from "react";
import { PagesShell } from "@/components/pages/PagesShell";
import { ListePages } from "@/components/pages/ListePages";
import { offreDuDemandeur } from "@/lib/server/offre";
import { listerPages } from "@/lib/server/pages";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mes pages · GetSite" };

/** Rubrique « Pages » (GetSite) : les pages partagées depuis Claude. Privée (middleware). */
export default async function PagesPage() {
  const { offre, userId } = await offreDuDemandeur();
  // La liste est lue ICI, avec la page : sans ça, le navigateur attendait le
  // HTML, puis le JavaScript, puis un appel /api/pages (et sa propre
  // vérification de session) avant d'afficher la moindre carte. En échec, la
  // liste retombe sur l'appel du navigateur, comme avant.
  const initiales = userId ? await listerPages(userId).catch(() => null) : null;
  return (
    <PagesShell offre={offre}>
      <Suspense>
        <ListePages offre={offre} initiales={initiales} />
      </Suspense>
    </PagesShell>
  );
}
