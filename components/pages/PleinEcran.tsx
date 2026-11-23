"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CadreApercu } from "./CadreApercu";
import styles from "./pages.module.css";

/** Le document seul, sur toute la fenêtre, avec un retour discret vers la fiche. */
export function PleinEcran({ id }: { id: string }) {
  const v = useSearchParams().get("v") ?? "";
  // Cadre monté APRÈS l'hydratation : rendu côté serveur, son `load` arriverait avant React et le repli ne jugerait rien.
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const src = `/api/pages/${encodeURIComponent(id)}/apercu${v ? `?v=${encodeURIComponent(v)}` : ""}`;
  return (
    <div className={styles.pleinEcran}>
      <a href={`/pages/${encodeURIComponent(id)}`} className={styles.pleinEcranRetour}>
        ← Retour à la fiche
      </a>
      {monte && (
        <CadreApercu
          className={styles.pleinEcranCadre}
          src={src}
          titre="Aperçu en plein écran"
          stockage={{ url: `/api/pages/${encodeURIComponent(id)}/stockage`, portee: `auteur:${id}` }}
        />
      )}
    </div>
  );
}
