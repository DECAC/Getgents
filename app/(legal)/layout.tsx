import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./legal.module.css";
import { PiedLegal } from "@/components/shared/PiedLegal";

/**
 * Cadre commun aux pages d'information : mentions légales, confidentialité,
 * contact, à propos.
 *
 * Ces pages sont publiques et sans session — c'est le but. Un visiteur, un
 * moteur de recherche ou un service de catégorisation réseau doit pouvoir
 * savoir qui édite Getgents sans avoir à créer de compte.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.contenu}>
        <Link href="/" className={styles.retour}>
          <span aria-hidden="true">←</span>
          Getgents
        </Link>
        {children}
        {/* Les quatre pages se lient entre elles. Un groupe de pages qu'aucune
            autre ne cite est un cul-de-sac : le robot d'un catégoriseur qui
            arrive sur les mentions légales doit trouver la confidentialité
            depuis là, sans repasser par l'accueil. */}
        <PiedLegal />
      </div>
    </main>
  );
}
