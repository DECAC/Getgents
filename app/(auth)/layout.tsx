import type { ReactNode } from "react";
import styles from "./auth.module.css";
import { PiedLegal } from "@/components/shared/PiedLegal";
import { BrandWordmark } from "@/components/shared/BrandMark";

/** Cadre commun aux écrans d'authentification. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <BrandWordmark which="getgents" layout="auth" />
        </div>
        {children}
      </div>
      <PiedLegal />
    </div>
  );
}
