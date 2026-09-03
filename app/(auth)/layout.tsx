import type { ReactNode } from "react";
import styles from "./auth.module.css";
import { PiedLegal } from "@/components/shared/PiedLegal";

/** Cadre commun aux écrans d'authentification. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark}>G</span>
          <span className={styles.brandName}>Getgents</span>
        </div>
        {children}
      </div>
      <PiedLegal />
    </div>
  );
}
