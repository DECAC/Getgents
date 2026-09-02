"use client";

import { useNavMobile } from "@/lib/context/NavMobileContext";
import styles from "./BoutonNavMobile.module.css";

/**
 * Ouvre le rail sur petit écran. Invisible au-dessus de 860 px, où la colonne
 * est déjà là.
 *
 * `flottant` sert aux écrans qui n'ont pas d'en-tête où le loger — le
 * super-gent et la liste du studio : le bouton s'y pose au-dessus du contenu
 * et suit le défilement.
 */
export function BoutonNavMobile({ flottant = false }: { flottant?: boolean }) {
  const { ouvert, basculer } = useNavMobile();

  return (
    <button
      type="button"
      className={[styles.bouton, flottant ? styles.flottant : ""].filter(Boolean).join(" ")}
      onClick={basculer}
      aria-expanded={ouvert}
      aria-controls="rail"
      aria-label={ouvert ? "Fermer la navigation" : "Ouvrir la navigation"}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {ouvert ? (
          <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </>
        ) : (
          <>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </>
        )}
      </svg>
    </button>
  );
}
