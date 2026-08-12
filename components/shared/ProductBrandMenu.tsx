"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductBrandMenu.module.css";

export type ProductSurface = "studio" | "space";

/**
 * Bascule Gent' studio ↔ Gent' space : une seule porte d'entrée, le clic sur
 * le titre en haut à gauche. Pas de lien parallèle ailleurs dans l'interface.
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

  const title = surface === "studio" ? "Gent' studio" : "Getgents";

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
          {surface === "studio" ? (
            <>
              <a href="/builder" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                </svg>
                <span>
                  <span className={styles.menuLabel}>Accueil du studio</span>
                  <span className={styles.menuSub}>Décrire et construire un nouveau gent</span>
                </span>
              </a>
              <a href="/accueil" className={styles.menuItemBlue} role="menuitem" onClick={() => setOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
                </svg>
                <span>
                  <span className={styles.menuLabel}>Gent&apos; space</span>
                  <span className={styles.menuSub}>Interroger vos gents actifs</span>
                </span>
              </a>
            </>
          ) : (
            <>
              <a href="/accueil" className={styles.menuItemBlue} role="menuitem" onClick={() => setOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                </svg>
                <span>
                  <span className={styles.menuLabel}>Accueil Gent&apos; space</span>
                  <span className={styles.menuSub}>Interroger vos gents actifs</span>
                </span>
              </a>
              <a href="/builder" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
                </svg>
                <span>
                  <span className={styles.menuLabel}>Gent&apos; studio</span>
                  <span className={styles.menuSub}>Construire et configurer un gent</span>
                </span>
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
