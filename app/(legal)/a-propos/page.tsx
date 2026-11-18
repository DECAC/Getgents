import type { Metadata } from "next";
import { CREDITS, EDITEUR } from "@/lib/legal";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "À propos — Getgents",
  description:
    "Getgents Pages : partagez ce que vous créez avec l'IA, par un lien privé, avec un assistant qui répond aux questions de votre lecteur.",
  alternates: { canonical: "/a-propos" },
};

export default function AProposPage() {
  return (
    <>
      <h1 className={styles.titre}>À propos de Getgents</h1>
      <p className={styles.chapeau}>
        Getgents Pages transforme ce que vous créez avec l&apos;IA — un artefact Claude, un
        canvas ChatGPT ou Mistral — en une page que vous envoyez à la bonne personne, par un
        lien privé.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce qu&apos;on y fait</h2>
        <ul className={styles.liste}>
          <li>
            <b>Partager.</b> Un lien privé par destinataire, qu&apos;il ouvre sans compte.
            L&apos;accès peut être protégé par un code envoyé à son adresse.
          </li>
          <li>
            <b>Répondre.</b> Un assistant répond aux questions du lecteur à partir de la page ;
            quand elle ne dit rien, il le dit, et l&apos;auteur peut compléter.
          </li>
          <li>
            <b>Suivre.</b> L&apos;auteur voit quand la page est ouverte. Le détail de lecture
            seulement si le lecteur accepte de le partager.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce que nous tenons</h2>
        <p className={styles.texte}>
          Une page appartient à son auteur. Elle est affichée isolée, sur un domaine distinct,
          sans accès au compte de personne ; rien de ce qu&apos;elle contient ne sert à
          entraîner de modèle. La lecture est anonyme par défaut.
        </p>
        <p className={styles.texte}>
          Le détail de ce qui est traité, et par qui, est sur{" "}
          <a href="/confidentialite">la page confidentialité</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Et les gents ?</h2>
        <p className={styles.texte}>
          Getgents est né comme un atelier d&apos;assistants — des « gents » — qu&apos;on
          construit puis partage. Cet atelier n&apos;est pas ouvert au public ; les gents déjà
          diffusés restent accessibles à leur adresse.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Qui édite le service</h2>
        <p className={styles.texte}>
          Un particulier, à titre non professionnel. Les informations complètes sont sur{" "}
          <a href="/mentions-legales">les mentions légales</a>, et l&apos;on nous écrit à{" "}
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>

      <section className={styles.section} id="credits">
        <h2 className={styles.sousTitre}>Crédits</h2>
        <p className={styles.texte}>
          Conçu et développé par{" "}
          <a href={CREDITS.profil} target="_blank" rel="noreferrer noopener">
            {CREDITS.auteur}
          </a>
          .
        </p>
      </section>
    </>
  );
}
