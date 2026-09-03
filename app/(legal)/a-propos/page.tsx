import type { Metadata } from "next";
import { EDITEUR } from "@/lib/legal";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "À propos — Getgents",
  description:
    "Getgents permet de construire un assistant à partir d'une description, de le partager ou de le publier.",
  alternates: { canonical: "/a-propos" },
};

export default function AProposPage() {
  return (
    <>
      <h1 className={styles.titre}>À propos de Getgents</h1>
      <p className={styles.chapeau}>
        Décrivez ce dont vous avez besoin, et Getgents en fait un gent : un assistant qui
        connaît vos documents, interroge vos sources et produit ce que vous lui demandez.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce qu&apos;on y fait</h2>
        <ul className={styles.liste}>
          <li>
            <b>Construire.</b> On décrit un rôle en une phrase ; l&apos;assistant de
            configuration propose une première version qu&apos;on affine.
          </li>
          <li>
            <b>Brancher.</b> Documents, sources ouvertes, API, boîte mail : le gent travaille
            sur ce qu&apos;on lui donne.
          </li>
          <li>
            <b>Partager.</b> À une personne, par un lien — sans qu&apos;elle ait de compte à
            créer — ou publiquement, à une adresse qui lui est propre.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce que nous tenons</h2>
        <p className={styles.texte}>
          Un gent appartient à son créateur. Ses instructions ne sont jamais montrées à ceux
          qui l&apos;utilisent, ses documents restent les siens, et rien de tout cela ne sert
          à entraîner de modèle. Un créateur peut brancher sa propre clé de modèle : il paie
          alors ses appels, et n&apos;est plus tributaire de nos plafonds.
        </p>
        <p className={styles.texte}>
          Le détail de ce qui est traité, et par qui, est sur{" "}
          <a href="/confidentialite">la page confidentialité</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Qui édite le service</h2>
        <p className={styles.texte}>
          {EDITEUR.raisonSociale}. Les informations complètes sont sur{" "}
          <a href="/mentions-legales">les mentions légales</a>, et l&apos;on nous écrit à{" "}
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>
    </>
  );
}
