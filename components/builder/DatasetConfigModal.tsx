"use client";

import { useEffect, useMemo, useState } from "react";
import { parseDatasetUrl } from "@/lib/opendatasoft";
import styles from "./McpConfigModal.module.css";

interface Props {
  onClose: () => void;
  onSubmit: (values: { name: string; url: string }) => void;
}

/**
 * Ajout d'un connecteur « Dataset open data » : le builder colle simplement
 * l'URL de la page du dataset (ex. opendata.paris.fr/explore/dataset/…) —
 * on en extrait le portail et l'identifiant, sans configuration technique.
 */
export function DatasetConfigModal({ onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const parsed = useMemo(() => parseDatasetUrl(url), [url]);
  const canSubmit = name.trim() !== "" && !!parsed;

  function handleSubmit() {
    if (!canSubmit || !parsed) return;
    onSubmit({ name: name.trim(), url: url.trim() });
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3 className={styles.title} id="dataset-modal-title">
            Ajouter un dataset open data
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.hero}>
            <div className={styles.heroMark} aria-hidden="true">
              🗺️
            </div>
            <div className={styles.heroLabel}>Dataset open data (Opendatasoft)</div>
          </div>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              Nom de l&apos;outil <span className={styles.req}>*</span>
            </span>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Toilettes publiques de Paris"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              URL du dataset
              <span
                className={styles.infoDot}
                title="Collez l'adresse de la page du jeu de données depuis votre navigateur — carte ou tableau, peu importe."
              >
                ⓘ
              </span>
              <span className={styles.req}>*</span>
            </span>
            <input
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://opendata.paris.fr/explore/dataset/sanisettesparis/…"
            />
            <span className={styles.hint}>
              {parsed
                ? `Dataset détecté : ${parsed.datasetId} (portail ${parsed.domain}). ${
                    parsed.domain.includes("opendatasoft")
                      ? "Interrogation par filtres (commune INSEE, type de bien…) pour les jeux DVF, ou par proximité GPS si géolocalisé."
                      : "Le gent pourra l'interroger selon son type."
                  }`
                : url.trim()
                  ? "URL non reconnue — collez une page « explore/dataset » d'un portail open data (opendata.paris.fr, data.gouv.fr…)."
                  : "Collez l'adresse complète de la page du dataset pour continuer."}
            </span>
          </label>
        </div>

        <div className={styles.foot}>
          <button className={styles.btnGhost} onClick={onClose}>
            Retour
          </button>
          <button className={styles.btnPrim} onClick={handleSubmit} disabled={!canSubmit}>
            Ajouter le dataset
          </button>
        </div>
      </div>
    </div>
  );
}
