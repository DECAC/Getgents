"use client";

import { EspaceProvider } from "@/lib/context/EspaceContext";
import { Rail } from "@/components/rail/Rail";
import { SuperGentHome } from "./SuperGentHome";
import { BoutonNavMobile } from "@/components/shared/BoutonNavMobile";
import styles from "./SuperGentShell.module.css";

/**
 * Page d'accueil du Gent' space : le « super gent ».
 *
 * Elle réutilise l'EspaceProvider — non pour ouvrir un espace, mais parce
 * qu'il détient la liste des gents publiés (hydratée depuis le cache local et
 * Supabase). C'est cette liste que le super gent interroge, et c'est elle
 * qu'affiche le rail à gauche.
 */
function SuperGentInner() {
  return (
    <div className={styles.shell}>
      <Rail />
      <main className={styles.main} id="main-content">
        <BoutonNavMobile flottant />
        <SuperGentHome />
      </main>
    </div>
  );
}

export function SuperGentShell({ initialId }: { initialId: string }) {
  return (
    <EspaceProvider initialId={initialId}>
      <SuperGentInner />
    </EspaceProvider>
  );
}
