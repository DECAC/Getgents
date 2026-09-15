"use client";

import { useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { draftToEspace } from "@/lib/publishedGents";
import { MAX_STARTER_CHARS } from "@/lib/starterSignal";
import styles from "./PromptTab.module.css";

/**
 * Questions d'amorce — les bulles « Par quoi commencer ? ».
 *
 * Jusqu'ici, la plateforme les générait à la première ouverture d'un espace,
 * les mémorisait, et ne les régénérait PLUS JAMAIS : la condition est
 * littéralement « si des amorces existent, ne rien faire ». Aucun écran ne
 * permettait de les voir, de les corriger ni de les relancer. Le créateur
 * n'avait donc aucune main sur les cinq premières phrases que lit un visiteur.
 *
 * Pire, le générateur reçoit une consigne de style — « rédige-les à la
 * première personne (« Peux-tu… », « Comment… ») » — qui contredit
 * frontalement celle qu'un créateur peut avoir écrite dans son prompt. Ses
 * exemples n'avaient aucune chance d'aboutir.
 *
 * Ce qu'écrit le créateur FAIT FOI : dès qu'une amorce est saisie, le
 * générateur ne s'exécute plus. Vider la liste rend la main à la génération
 * automatique.
 */
export function Amorces() {
  const { currentDraft, updateStarters } = useBuilder();
  const amorces = currentDraft.starters ?? [];

  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function modifier(i: number, valeur: string) {
    const suite = [...amorces];
    suite[i] = valeur;
    updateStarters(suite);
  }

  async function regenerer() {
    setOccupe(true);
    setErreur(null);
    try {
      const res = await fetch("/api/starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espace: draftToEspace(currentDraft) }),
      });
      const data = (await res.json().catch(() => ({}))) as { starters?: string[]; error?: string };
      if (!res.ok || !data.starters?.length) {
        setErreur(
          data.error === "quota"
            ? "Votre quota horaire est atteint. Réessayez plus tard."
            : "La génération a échoué. Réessayez, ou écrivez vos amorces à la main."
        );
        return;
      }
      updateStarters(data.starters);
    } catch {
      setErreur("Le serveur n'a pas répondu. Réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className={styles.card}>
      <h4 className={styles.title}>Questions d&apos;amorce</h4>
      <div className={styles.sub}>
        Les bulles proposées au visiteur avant qu&apos;il n&apos;écrive. Tant que cette liste est
        vide, elles sont générées automatiquement à la première ouverture — et plus jamais
        recalculées. Dès que vous en écrivez une, les vôtres font foi.
      </div>

      <ul className={styles.amorceList}>
        {amorces.map((a, i) => (
          <li key={i} className={styles.amorceItem}>
            <input
              type="text"
              className={styles.champ}
              value={a}
              maxLength={MAX_STARTER_CHARS}
              onChange={(e) => modifier(i, e.target.value)}
              aria-label={`Question d'amorce ${i + 1}`}
            />
            <button
              type="button"
              className={styles.amorceRetirer}
              onClick={() => updateStarters(amorces.filter((_, j) => j !== i))}
              aria-label={`Retirer la question ${i + 1}`}
              title="Retirer"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.amorceActions}>
        <button
          type="button"
          className={styles.amorceAjouter}
          onClick={() => updateStarters([...amorces, ""])}
        >
          + Ajouter une question
        </button>
        <button type="button" className={styles.amorceAjouter} disabled={occupe} onClick={regenerer}>
          {occupe ? "Génération…" : amorces.length ? "Régénérer (remplace tout)" : "Proposer des amorces"}
        </button>
      </div>

      {erreur && <p className={styles.amorceErreur}>{erreur}</p>}

      <div className={styles.footRow}>
        <span>
          {amorces.length
            ? `${amorces.length} amorce${amorces.length > 1 ? "s" : ""} — les vôtres, pas celles du modèle.`
            : "Aucune amorce : la plateforme en proposera."}
        </span>
        <span>Rediffusez pour les appliquer en ligne</span>
      </div>
    </div>
  );
}
