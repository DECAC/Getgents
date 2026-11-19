import { PagesShell } from "@/components/pages/PagesShell";
import { GalerieModeles } from "@/components/pages/GalerieModeles";
import { offreDuDemandeur } from "@/lib/server/offre";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modèles · Getgents Pages" };

/** Rubrique « Modèles » : les pages fictives à essayer puis adapter. Privée (middleware, préfixe /pages). */
export default async function PageModeles() {
  const { offre } = await offreDuDemandeur();
  return (
    <PagesShell offre={offre}>
      <GalerieModeles />
    </PagesShell>
  );
}
