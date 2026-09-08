import type { Metadata } from "next";
import { EDITEUR, HEBERGEURS, DERNIERE_REVISION } from "@/lib/legal";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Mentions légales — Getgents",
  description: "Éditeur, directeur de la publication et hébergeurs du service Getgents.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <>
      <h1 className={styles.titre}>Mentions légales</h1>
      <p className={styles.chapeau}>
        Getgents est une plateforme qui permet de construire des assistants — des « gents » —
        et de les partager ou de les publier.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Éditeur</h2>
        <dl className={styles.dl}>
          <dt>Éditeur</dt>
          <dd>{EDITEUR.nom}</dd>
          <dt>Qualité</dt>
          <dd>{EDITEUR.qualite}</dd>
          <dt>Directeur de la publication</dt>
          <dd>{EDITEUR.directeurPublication}</dd>
          <dt>Contact</dt>
          <dd>
            <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>
          </dd>
          {EDITEUR.adressePostale && (
            <>
              <dt>Siège social</dt>
              <dd>{EDITEUR.adressePostale}</dd>
            </>
          )}
          {EDITEUR.immatriculation && (
            <>
              <dt>Immatriculation</dt>
              <dd>{EDITEUR.immatriculation}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={styles.section}>
        {/* Dire POURQUOI il n'y a ni siège ni immatriculation vaut mieux que
            de laisser deux lignes manquantes : un lecteur — ou un service de
            catégorisation réseau — y verrait sinon un oubli, voire une
            dissimulation. */}
        <p className={styles.texte}>
          Getgents est édité à titre personnel et non professionnel. À ce titre, et conformément
          à l&apos;article 6 III de la loi pour la confiance dans l&apos;économie numérique,
          l&apos;adresse postale de l&apos;éditeur est communiquée à l&apos;hébergeur et
          n&apos;est pas rendue publique. Il n&apos;existe aucune société éditrice à ce jour, et
          donc aucun numéro d&apos;immatriculation. Ces mentions seront complétées le jour où
          une structure sera immatriculée.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Hébergement</h2>
        {HEBERGEURS.map((h) => (
          <p key={h.nom} className={styles.texte}>
            <b>{h.nom}</b> — {h.role}
            <br />
            {h.adresse}
            <br />
            <a href={h.site} target="_blank" rel="noreferrer noopener">
              {h.site}
            </a>
          </p>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Propriété intellectuelle</h2>
        <p className={styles.texte}>
          Les gents créés sur Getgents appartiennent à leur créateur : leurs instructions,
          leurs documents et leurs productions restent sa propriété. Getgents n&apos;en
          revendique aucun droit et ne les exploite pas à d&apos;autres fins que de faire
          fonctionner le service pour lui.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Signaler un problème</h2>
        <p className={styles.texte}>
          Un contenu abusif diffusé par un gent public, une faille de sécurité, une
          réclamation : écrivez à{" "}
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>. Les signalements de
          sécurité peuvent aussi passer par{" "}
          <a href="/.well-known/security.txt">/.well-known/security.txt</a>.
        </p>
      </section>

      <p className={styles.note}>Dernière révision : {DERNIERE_REVISION}.</p>
    </>
  );
}
