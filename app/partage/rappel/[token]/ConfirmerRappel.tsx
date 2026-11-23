"use client";

import { useState } from "react";
import styles from "./rappel.module.css";

export default function ConfirmerRappel({ token, libelle, desabonner }: { token: string; libelle: string; desabonner: boolean }) {
  const [etat, setEtat] = useState<"attente" | "envoi" | "fait">("attente");
  const [erreur, setErreur] = useState<string | null>(null);

  async function agir() {
    setEtat("envoi");
    setErreur(null);
    try {
      const res = await fetch("/api/rappel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ?? "L'action a échoué. Réessayez.");
        setEtat("attente");
        return;
      }
      setEtat("fait");
    } catch {
      setErreur("Connexion impossible. Réessayez.");
      setEtat("attente");
    }
  }

  if (etat === "fait")
    return (
      <>
        <p className={styles.ok} role="status">{desabonner ? "C'est fait : vous ne recevrez plus ces rappels." : "C'est fait : vos liens sont prolongés de 30 jours."}</p>
        <a className={styles.lien} href="/pages">Ouvrir Mes pages</a>
      </>
    );
  return (
    <>
      {erreur && <p className={styles.erreur} role="alert">{erreur}</p>}
      <button type="button" className={styles.bouton} onClick={agir} disabled={etat === "envoi"}>
        {etat === "envoi" ? "…" : libelle}
      </button>
    </>
  );
}
