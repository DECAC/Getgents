"use client";

import styles from "./pages.module.css";
import { adresseDirecte, useCadreAvecRepli } from "@/components/shared/useCadreAvecRepli";

/**
 * Miniature d'une page : le VRAI rendu, réduit, dans le même cadre isolé que
 * chez le destinataire. Chargée seulement quand elle approche de l'écran
 * (`loading="lazy"`) : une liste de cinquante pages ne lance pas cinquante
 * documents d'un coup. Inerte : on ne joue pas avec une vignette.
 */
export function Vignette({ id, titre, version }: { id: string; titre: string; version: number }) {
  const src = `/api/pages/${encodeURIComponent(id)}/apercu?v=${version}`;
  const repli = useCadreAvecRepli(src);
  return (
    <span className={styles.vignette} aria-hidden="true">
      <iframe
        ref={repli.cadre}
        className={styles.vignetteCadre}
        src={repli.direct ? adresseDirecte(src) : src}
        onLoad={repli.onLoad}
        title={`Aperçu — ${titre}`}
        sandbox="allow-scripts"
        loading="lazy"
        tabIndex={-1}
        referrerPolicy="no-referrer"
      />
    </span>
  );
}
