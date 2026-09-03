import Link from "next/link";
import { EDITEUR } from "@/lib/legal";
import styles from "./PiedLegal.module.css";

/**
 * Pied de page des écrans publics.
 *
 * Ces liens ne sont pas décoratifs. Un domaine récent sans page d'éditeur
 * identifiable correspond au profil que les filtres réseau bloquent par
 * défaut — et une page légale que rien ne lie est une page qu'aucun robot ne
 * trouvera. Ils vivent donc là où l'on arrive sans compte.
 */
export function PiedLegal() {
  return (
    <footer className={styles.pied}>
      <span>© {EDITEUR.raisonSociale}</span>
      <Link href="/a-propos">À propos</Link>
      <Link href="/mentions-legales">Mentions légales</Link>
      <Link href="/confidentialite">Confidentialité</Link>
      <Link href="/contact">Contact</Link>
    </footer>
  );
}
