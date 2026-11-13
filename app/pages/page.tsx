import { Suspense } from "react";
import { PagesShell } from "@/components/pages/PagesShell";
import { ListePages } from "@/components/pages/ListePages";
import { offreDuDemandeur } from "@/lib/server/offre";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mes pages · GetSite" };

/** Rubrique « Pages » (GetSite) : les pages partagées depuis Claude. Privée (middleware). */
export default async function PagesPage() {
  const { offre } = await offreDuDemandeur();
  return (
    <PagesShell offre={offre}>
      <Suspense>
        <ListePages offre={offre} />
      </Suspense>
    </PagesShell>
  );
}
