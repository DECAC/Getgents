import type { Espace } from "@/lib/types";
import styles from "./EmptyCenter.module.css";

export function EmptyCenter({ espace }: { espace: Espace }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{espace.icon}</div>
      <p className={styles.text}>
        Cet espace ne génère pas encore d&apos;artefact dédié. Ouvrez la conversation pour
        échanger avec votre assistant.
      </p>
    </div>
  );
}
