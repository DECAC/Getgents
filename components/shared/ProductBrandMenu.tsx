"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductBrandMenu.module.css";
import { BrandIcon, BrandWordmark } from "@/components/shared/BrandMark";
import type { BrandWordmarkKey } from "@/lib/brand";
import { BRAND_LABEL } from "@/lib/brand";

export type ProductSurface = "studio" | "space" | "accueil";

const WORDMARK: Record<ProductSurface, BrandWordmarkKey> = {
  studio: "getstudio",
  space: "getspace",
  accueil: "getgents",
};

const DESTINATIONS: Record<ProductSurface, { href: string; sous: string; chemins: string[] }> = {
  accueil: {
    href: "/accueil",
    sous: "Décrire le gent dont vous avez besoin",
    chemins: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"],
  },
  space: {
    href: "/myspace",
    sous: "Interroger vos gents actifs",
    chemins: ["M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z"],
  },
  studio: {
    href: "/builder",
    sous: "Construire et configurer un gent",
    chemins: [
      "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
    ],
  },
};

/** Les deux autres surfaces, dans un ordre stable. */
const AUTRES: Record<ProductSurface, ProductSurface[]> = {
  accueil: ["space", "studio"],
  space: ["accueil", "studio"],
  studio: ["accueil", "space"],
};

/**
 * Bascule entre les trois surfaces : une seule porte d'entrée, le clic sur le
 * titre en haut à gauche.
 *
 *   Getgents  → /accueil
 *   GetSpace  → /myspace
 *   GetStudio → /builder
 */
export function ProductBrandMenu({
  surface,
  compact = false,
}: {
  surface: ProductSurface;
  /** Rail replié : n'affiche que l'icône GG. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const title = BRAND_LABEL[WORDMARK[surface]];

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
      >
        <span className={styles.mark} aria-hidden="true">
          <BrandIcon size={22} />
        </span>
        {!compact && (
          <span className={styles.wordmarkSlot}>
            <BrandWordmark which={WORDMARK[surface]} height={surface === "space" ? 26 : 24} />
          </span>
        )}
        {!compact && (
          <svg
            className={styles.chevron}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {AUTRES[surface].map((cible) => {
            const d = DESTINATIONS[cible];
            const label = BRAND_LABEL[WORDMARK[cible]];
            return (
              <a
                key={cible}
                href={d.href}
                className={cible === "space" ? styles.menuItemBlue : styles.menuItem}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className={styles.menuMark} aria-hidden="true">
                  <BrandIcon size={18} />
                </span>
                <span>
                  <span className={styles.menuLabel}>{label}</span>
                  <span className={styles.menuSub}>{d.sous}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
