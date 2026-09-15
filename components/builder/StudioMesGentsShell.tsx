"use client";

import { BuilderRail } from "./BuilderRail";
import { MesGentsTab } from "./tabs/MesGentsTab";
import { BoutonNavMobile } from "@/components/shared/BoutonNavMobile";
import styles from "./StudioMesGentsShell.module.css";

/**
 * Liste « Mes gents » au niveau studio : tuiles ou lignes, sans bandeau d'un
 * gent particulier ni assistant de configuration. C'est la vue que l'on
 * atteint en cliquant « Mes gents » dans le rail — distincte de
 * /builder/{gentId}?tab=mesgents qui mélangeait liste et édition.
 */
export function StudioMesGentsShell() {
  return (
    <div className={styles.shell}>
      <BuilderRail mode="list" />
      <main className={styles.main} id="builder-main">
        <BoutonNavMobile flottant />
        <MesGentsTab />
      </main>
    </div>
  );
}
