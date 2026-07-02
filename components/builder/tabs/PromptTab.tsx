"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./PromptTab.module.css";

export function PromptTab() {
  const { currentDraft, updateSystemPrompt } = useBuilder();
  const wordCount = currentDraft.systemPrompt.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Instructions système (prompt)</h4>
        <div className={styles.sub}>
          Ce texte définit le comportement du gent en production. Décrivez son rôle, ses règles
          impératives (ex. invariants de sécurité) et le ton attendu — l&apos;assistant du builder
          peut vous aider à le rédiger.
        </div>
        <textarea
          className={styles.promptArea}
          value={currentDraft.systemPrompt}
          onChange={(e) => updateSystemPrompt(e.target.value)}
          placeholder={
            "Tu es [nom du gent] de Getgents.\n\nObjectif : ...\n\nRègles impératives :\n- ...\n- ..."
          }
          aria-label="Prompt système du gent"
        />
        <div className={styles.footRow}>
          <span>{wordCount} mot{wordCount !== 1 ? "s" : ""}</span>
          <span>Modifiable à tout moment — versionné à chaque publication</span>
        </div>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>Bonnes pratiques</h4>
        <div className={styles.tips}>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Formulez l&apos;objectif premier en une phrase claire avant les règles de détail.
          </div>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Explicitez les invariants non négociables (ex. « jamais de paiement autonome »).
          </div>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Précisez quand mettre à jour la mémoire et quels artefacts générer.
          </div>
        </div>
      </div>
    </div>
  );
}
