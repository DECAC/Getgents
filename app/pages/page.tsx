import { Suspense } from "react";
import { PagesShell } from "@/components/pages/PagesShell";
import { ListePages } from "@/components/pages/ListePages";

export const metadata = { title: "Mes pages · GetSite" };

/** Rubrique « Pages » (GetSite) : les pages partagées depuis Claude. Privée (middleware). */
export default function PagesPage() {
  return (
    <PagesShell>
      <Suspense>
        <ListePages />
      </Suspense>
    </PagesShell>
  );
}
