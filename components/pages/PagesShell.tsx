"use client";

import { Suspense } from "react";
import { RailPages } from "./RailPages";
import { BoutonNavMobile } from "@/components/shared/BoutonNavMobile";
import styles from "@/components/builder/StudioMesGentsShell.module.css";

/** Coquille de la rubrique « Pages » : le même cadre que « Mes gents ». */
export function PagesShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Suspense>
        <RailPages />
      </Suspense>
      <main className={styles.main}>
        <BoutonNavMobile flottant />
        {children}
      </main>
    </div>
  );
}
