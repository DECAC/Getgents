import type { Metadata } from "next";
import { EDITEUR } from "@/lib/legal";
import { lienDemandeAcces } from "@/lib/inscriptions";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Contact — Getgents",
  description: "Comment joindre l'équipe de Getgents : accès, sécurité, questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <h1 className={styles.titre}>Nous écrire</h1>
      <p className={styles.chapeau}>
        Une seule adresse, relevée par une personne :{" "}
        <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Demander un accès</h2>
        <p className={styles.texte}>
          Getgents est en accès restreint : nous accueillons les premiers créateurs un par
          un. <a href={lienDemandeAcces()}>Écrivez-nous</a> en disant en deux lignes ce que
          vous aimeriez construire.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Signaler une faille</h2>
        <p className={styles.texte}>
          Écrivez à la même adresse, en décrivant ce que vous avez trouvé et comment le
          reproduire. Nous répondons. Les coordonnées sont aussi publiées à{" "}
          <a href="/.well-known/security.txt">/.well-known/security.txt</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Signaler un gent</h2>
        <p className={styles.texte}>
          Un gent publié dont le contenu vous paraît abusif, trompeur ou illicite : indiquez
          son adresse et ce qui vous a alerté. Nous pouvons le dépublier.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Vos données</h2>
        <p className={styles.texte}>
          Accès, rectification, effacement : voir{" "}
          <a href="/confidentialite">la page confidentialité</a>. La suppression de compte
          est directement à votre main depuis « Mon compte ».
        </p>
      </section>
    </>
  );
}
