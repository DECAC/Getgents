import styles from "./ThinkingIndicator.module.css";

/** Indicateur visuel pendant que le modèle réfléchit, consulte un outil ou rédige. */
export function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-label={label}>
      <div className={styles.orb} aria-hidden="true">
        <span className={styles.spark} />
        <span className={styles.ring} />
        <span className={styles.core} />
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
