"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SelecteurMode } from "@/components/shared/SelecteurMode";
import { MenuCompte } from "@/components/compte/MenuCompte";
import { useNavMobile } from "@/lib/context/NavMobileContext";
import styles from "@/components/builder/BuilderRail.module.css";

/**
 * Rail de la rubrique « Pages » (GetSite). Mêmes styles et même tiroir que le
 * rail du studio, pour que les trois modes se ressemblent ; ses entrées sont
 * les siennes. Pas de « + Nouvelle page » : une page naît dans Claude ou
 * ChatGPT — d'où « Connecter Claude / ChatGPT ».
 */
export function RailPages() {
  const { ouvert } = useNavMobile();
  const [replie, setReplie] = useState(false);
  const chemin = usePathname();
  const guide = useSearchParams().get("guide") === "1";

  const entree = (href: string, libelle: string, icone: React.ReactNode, on: boolean) => (
    <a href={href} className={[styles.navItem, on ? styles.navItemOn : ""].filter(Boolean).join(" ")}
      style={{ textDecoration: "none" }}
      aria-current={on ? "page" : undefined} title={libelle}>
      <span className={styles.navIcon}>{icone}</span>
      <span className={styles.navLabel}>{libelle}</span>
    </a>
  );

  return (
    <nav
      className={[styles.rail, replie ? styles.collapsed : "", ouvert ? styles.open : ""].filter(Boolean).join(" ")}
      aria-label="Navigation des pages"
      data-replie={replie ? "oui" : undefined}
    >
      <div className={styles.brand}>
        <SelecteurMode
          mode="pages"
          compact={replie}
          aCote={
            <button className={styles.railToggle} onClick={() => setReplie((r) => !r)} aria-label={replie ? "Déployer la colonne" : "Réduire la colonne"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: replie ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}>
                <path d="M14 6l-6 6 6 6" />
              </svg>
            </button>
          }
        />
      </div>
      <div className={styles.nav}>
        <div className={styles.section}>
          {entree(
            "/pages",
            "Mes pages",
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" />
            </svg>,
            !!chemin?.startsWith("/pages") && !guide
          )}
          {entree(
            "/pages?guide=1",
            "Connecter Claude / ChatGPT",
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4" />
            </svg>,
            guide
          )}
        </div>
      </div>
      <MenuCompte />
    </nav>
  );
}
