"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./ArtefactsTab.module.css";

export function ArtefactsTab() {
  const { currentDraft, toggleArtefactTemplate } = useBuilder();

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        Choisissez les types d&apos;artefacts que ce gent peut générer automatiquement au fil de la
        conversation avec l&apos;utilisateur final. Chaque artefact activé devient disponible pour
        l&apos;assistant en production, dans l&apos;espace de l&apos;utilisateur.
      </p>
      <div className={styles.grid}>
        {currentDraft.artefactTemplates.map((tpl) => (
          <button
            key={tpl.id}
            className={[styles.card, tpl.enabled ? styles.enabled : ""].filter(Boolean).join(" ")}
            onClick={() => toggleArtefactTemplate(tpl.id)}
            aria-pressed={tpl.enabled}
          >
            <div className={styles.top}>
              <span className={styles.label}>{tpl.label}</span>
              <span className={styles.switch} aria-hidden="true" />
            </div>
            <div className={styles.desc}>{tpl.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
