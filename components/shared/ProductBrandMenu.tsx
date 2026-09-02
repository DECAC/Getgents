"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductBrandMenu.module.css";

export type ProductSurface = "studio" | "space" | "accueil";

const TITRES: Record<ProductSurface, string> = {
  studio: "Gent' studio",
  space: "Gent' space",
  accueil: "Getgents",
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
 * titre en haut à gauche. Pas de lien parallèle ailleurs dans l'interface.
 *
 *   Getgents     → /accueil   décrire le gent dont on a besoin
 *   Gent' space  → /myspace   interroger ses gents actifs
 *   Gent' studio → /builder   construire et configurer un gent
 *
 * Le menu affiche les DEUX autres surfaces, jamais celle où l'on se trouve :
 * une entrée qui renvoie sur la page courante n'apprend rien et fait douter
 * de l'endroit où l'on est.
 */
export function ProductBrandMenu({ surface }: { surface: ProductSurface }) {
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

  const title = TITRES[surface];

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
        <span
          className={surface === "studio" ? styles.markStudio : styles.markSpace}
          aria-hidden="true"
        />
        <span className={surface === "space" ? styles.nameSpace : styles.name}>{title}</span>
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
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {AUTRES[surface].map((cible) => {
            const d = DESTINATIONS[cible];
            return (
              <a
                key={cible}
                href={d.href}
                className={cible === "space" ? styles.menuItemBlue : styles.menuItem}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {d.chemins.map((c) => (
                    <path key={c} d={c} />
                  ))}
                </svg>
                <span>
                  <span className={styles.menuLabel}>{TITRES[cible]}</span>
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
