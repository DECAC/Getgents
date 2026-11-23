"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./pages.module.css";

/**
 * « Données partagées » de l'onglet Page : ce que la page a enregistré par
 * le stockage partagé des artefacts (`window.storage` avec `shared`), commun
 * à tous ses lecteurs — des votes, des inscriptions. Absent tant que la page
 * n'a rien enregistré. « Effacer » remet tout à zéro, après confirmation.
 */
export function BlocDonneesPartagees({ pageId, onMessage }: { pageId: string; onMessage: (m: string) => void }) {
  const [resume, setResume] = useState<{ cles: number; taille: number } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const url = `/api/pages/${encodeURIComponent(pageId)}/stockage`;

  const charger = useCallback(() => {
    void fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d: { resume?: { cles: number; taille: number } | null }) => setResume(d.resume ?? null))
      .catch(() => setResume(null));
  }, [url]);

  useEffect(() => {
    charger();
    // La fiche se relit au retour sur l'onglet : les votes ont pu changer.
    window.addEventListener("focus", charger);
    return () => window.removeEventListener("focus", charger);
  }, [charger]);

  if (!resume || resume.cles === 0) return null;

  const effacer = async () => {
    if (!window.confirm("Effacer les données partagées de cette page (votes, réponses enregistrées par la page) ? Tous les lecteurs repartiront de zéro.")) return;
    setEnCours(true);
    try {
      const r = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error();
      setResume({ cles: 0, taille: 0 });
      onMessage("Données partagées effacées.");
    } catch {
      onMessage("Les données n'ont pas pu être effacées. Réessayez.");
    } finally {
      setEnCours(false);
    }
  };

  const ko = Math.max(1, Math.round(resume.taille / 1024));
  return (
    <section className={styles.bloc}>
      <h3 className={styles.blocTitre}>Données partagées</h3>
      <p className={styles.aide}>
        La page enregistre des données communes à tous ses lecteurs (des votes, par exemple) :{" "}
        {resume.cles} {resume.cles > 1 ? "entrées" : "entrée"}, {ko} Ko.
      </p>
      <button type="button" className={styles.lienDanger} onClick={() => void effacer()} disabled={enCours}>
        {enCours ? "Effacement…" : "Effacer les données partagées"}
      </button>
    </section>
  );
}
