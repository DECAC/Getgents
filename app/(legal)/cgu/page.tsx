import type { Metadata } from "next";
import { EDITEUR } from "@/lib/legal";
import { PLAFONDS_PAGES } from "@/lib/offre";
import styles from "../legal.module.css";

/**
 * Conditions d'utilisation (23/11). Exigées par les annuaires de connecteurs.
 * Rédigées par l'agent, NON relues par un juriste au moment de l'écriture :
 * voir CLAUDE.md. Le service est gratuit et l'éditeur un particulier — tout
 * changement de ces deux faits change ce texte.
 */
const REVISION_CGU = "23 novembre 2026";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Getgents",
  description: "Règles d'utilisation de Getgents Pages : compte, contenus publiés, lecteurs, assistant, retrait.",
  alternates: { canonical: "/cgu" },
};

export default function CguPage() {
  return (
    <>
      <h1 className={styles.titre}>Conditions d&apos;utilisation</h1>
      <p className={styles.chapeau}>
        Getgents Pages permet de partager, par un lien privé, une page créée avec une IA, et d&apos;en recueillir la
        réponse. En créant un compte ou en partageant une page, vous acceptez les règles ci-dessous.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>1. Le service</h2>
        <p className={styles.texte}>
          Getgents est édité par un particulier, à titre non professionnel (voir{" "}
          <a href="/mentions-legales">les mentions légales</a>). Le service est gratuit et proposé en l&apos;état, en phase
          d&apos;essai : ses fonctions, ses limites et sa disponibilité peuvent changer, et il peut être interrompu. Aucune
          garantie de disponibilité ni de conservation n&apos;est donnée : gardez une copie de vos pages.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>2. Votre compte</h2>
        <p className={styles.texte}>
          Le compte est personnel. Vous êtes responsable de ce qui est fait avec lui, y compris par un assistant IA que
          vous y avez connecté (connecteur). Les limites en vigueur sont de {PLAFONDS_PAGES.pages} pages,{" "}
          {PLAFONDS_PAGES.liensActifs} liens actifs et {PLAFONDS_PAGES.questionsParMois} questions à l&apos;assistant par
          mois ; elles peuvent évoluer.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>3. Vos pages</h2>
        <p className={styles.texte}>
          Vous restez titulaire de vos pages et seul responsable de leur contenu, comme de leur envoi. Vous autorisez
          Getgents à les stocker et à les afficher aux personnes à qui vous les partagez, le temps nécessaire au service.
          Vous vous engagez à ne pas publier :
        </p>
        <ul className={styles.liste}>
          <li>de contenu illégal, haineux, harcelant, ou portant atteinte aux droits d&apos;autrui (auteur, marque, image, vie privée) ;</li>
          <li>
            de page qui collecte des mots de passe, des coordonnées bancaires ou des données personnelles sous un faux
            prétexte, ou qui se fait passer pour une personne ou une organisation ;
          </li>
          <li>de code malveillant, ni de page qui cherche à contourner l&apos;isolement dans lequel elle est affichée ;</li>
          <li>les données personnelles d&apos;un tiers sans en avoir le droit ;</li>
          <li>d&apos;envois massifs non sollicités.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>4. Vos lecteurs</h2>
        <p className={styles.texte}>
          Vous choisissez à qui vous envoyez un lien. Ce que voit et transmet un lecteur est décrit dans{" "}
          <a href="/confidentialite">la page de confidentialité</a> : son détail de lecture n&apos;est transmis que
          s&apos;il le joint à une réponse. N&apos;utilisez pas Getgents pour suivre une personne à son insu.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>5. L&apos;assistant d&apos;une page</h2>
        <p className={styles.texte}>
          L&apos;assistant répond aux questions d&apos;un lecteur à partir de la page et des précisions de son auteur. Il
          peut se tromper. Ses réponses ne remplacent pas un engagement de l&apos;auteur, et Getgents n&apos;en garantit pas
          l&apos;exactitude.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>6. Signalement et retrait</h2>
        <p className={styles.texte}>
          Pour signaler une page illicite, écrivez à <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a> en
          indiquant son lien et la raison du signalement. Getgents peut retirer une page, couper ses liens ou suspendre
          un compte qui enfreint ces règles ou la loi, sans préavis lorsque l&apos;urgence ou la gravité le justifient.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>7. Responsabilité</h2>
        <p className={styles.texte}>
          Getgents héberge les pages de ses utilisateurs sans les relire. Sa responsabilité ne peut être engagée pour leur
          contenu que dans les conditions prévues par la loi pour les hébergeurs, ni pour une perte de données ou une
          interruption du service, dans les limites permises par la loi.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>8. Évolution et droit applicable</h2>
        <p className={styles.texte}>
          Ces conditions peuvent évoluer ; la date ci-dessous indique leur dernière révision. Elles sont soumises au droit
          français. Vous pouvez fermer votre compte à tout moment depuis « Mon compte ».
        </p>
        <p className={styles.texte}>Dernière révision : {REVISION_CGU}.</p>
      </section>
    </>
  );
}
