"use client";

import { useState } from "react";
import styles from "@/app/compte/compte.module.css";

/** Interrupteur « Rappels d'expiration » : un e-mail 24 à 48 h avant la fin d'un lien. */
export default function RappelsExpiration({ initial }: { initial: boolean }) {
  const [actifs, setActifs] = useState(initial);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function changer(valeur: boolean) {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch("/api/compte/rappels", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actifs: valeur }) });
      if (!res.ok) throw new Error();
      setActifs(valeur);
    } catch {
      setErreur("L'enregistrement a échoué. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className={styles.bloc} id="rappels">
      <h2 className={styles.sousTitre}>Rappels d'expiration</h2>
      <p className={styles.aide}>Un e-mail par jour au plus, la veille ou l'avant-veille de l'expiration d'un de vos liens, avec un bouton pour le prolonger.</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={actifs} disabled={occupe} onChange={(e) => changer(e.target.checked)} />
        Me prévenir par e-mail avant l'expiration de mes liens
      </label>
      {erreur && <p className={styles.message} role="alert">{erreur}</p>}
    </section>
  );
}
