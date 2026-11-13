"use client";

import { Suspense } from "react";
import { RailPages } from "./RailPages";
import type { Offre } from "@/lib/offre";
import { BoutonNavMobile } from "@/components/shared/BoutonNavMobile";
import styles from "@/components/builder/StudioMesGentsShell.module.css";

/** Coquille de la rubrique « Pages » : le même cadre que « Mes gents ». */
export function PagesShell({ children, offre }: { children: React.ReactNode; offre?: Offre }) {
  return (
    <div className={styles.shell}>
      <Suspense>
        <RailPages offre={offre} />
      </Suspense>
      <main className={styles.main}>
        <BoutonNavMobile flottant />
        {children}
      </main>
    </div>
  );
}
