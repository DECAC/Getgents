"use client";

import styles from "./FollowupChips.module.css";

interface Props {
  followups: string[];
  onPick: (question: string) => void;
}

/** Relances conversationnelles : un clic envoie la question telle quelle. */
export function FollowupChips({ followups, onPick }: Props) {
  if (!followups.length) return null;

  return (
    <div className={styles.wrap} role="group" aria-label="Questions pour poursuivre">
      <div className={styles.label}>Pour aller plus loin</div>
      <div className={styles.chips}>
        {followups.map((q) => (
          <button key={q} type="button" className={styles.chip} onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
