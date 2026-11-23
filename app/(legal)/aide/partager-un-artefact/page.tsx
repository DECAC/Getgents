import type { Metadata } from "next";
import styles from "../../legal.module.css";

/**
 * Page d'aide qui répond à UNE question, telle que les gens (et les IA qui
 * cherchent pour eux) la posent. Comparaison HONNÊTE : la publication
 * intégrée de Claude suffit souvent, et le dire est ce qui rend la page
 * crédible — pour un lecteur comme pour un modèle.
 */
export const metadata: Metadata = {
  title: "Envoyer un artefact Claude à quelqu'un qui n'a pas de compte",
  description:
    "Trois façons d'envoyer un artefact Claude ou un canvas à un client ou à un proche : la publication intégrée, le fichier, ou un lien privé Getgents Pages — et quand choisir laquelle.",
  alternates: { canonical: "/aide/partager-un-artefact" },
};

export default function PartagerArtefactPage() {
  return (
    <>
      <h1 className={styles.titre}>Envoyer un artefact Claude à quelqu&apos;un qui n&apos;a pas de compte</h1>
      <p className={styles.chapeau}>
        Vous avez créé avec Claude une page, un devis, un tableau ou une petite application, et vous voulez l&apos;envoyer
        à un client, à votre équipe ou à vos proches. Il y a trois façons de faire ; aucune n&apos;est la meilleure dans
        tous les cas.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>1. La publication intégrée de Claude</h2>
        <p className={styles.texte}>
          Claude peut publier un artefact et vous donner un lien. C&apos;est gratuit, immédiat, et ça suffit pour montrer
          une page à quelqu&apos;un. Mais le lien est le même pour tout le monde : quiconque l&apos;obtient peut ouvrir la
          page, vous ne savez pas qui l&apos;a lue, et le lecteur ne peut pas vous répondre depuis la page.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>2. Le fichier en pièce jointe</h2>
        <p className={styles.texte}>
          Vous copiez le code dans un fichier <code>.html</code> et l&apos;envoyez par e-mail. Le destinataire garde une
          copie, sans dépendre d&apos;aucun service. En revanche, beaucoup de messageries bloquent ou dénaturent les
          fichiers HTML, les pages interactives s&apos;ouvrent mal sur téléphone, et une correction oblige à renvoyer un
          nouveau fichier.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>3. Un lien privé Getgents Pages</h2>
        <p className={styles.texte}>
          Getgents est fait pour le cas où la page s&apos;adresse à quelqu&apos;un en particulier et où vous attendez
          quelque chose en retour :
        </p>
        <ul className={styles.liste}>
          <li>un lien par destinataire (ou par groupe, chacun choisissant son prénom) ;</li>
          <li>un accès par code envoyé à l&apos;adresse du destinataire, si la page est sensible ;</li>
          <li>un bouton de réponse (« Je souhaite donner suite », « Je viens »…) qui vous transmet ses choix ;</li>
          <li>un assistant qui répond à ses questions à partir de la page ;</li>
          <li>une correction qui met à jour tous les liens, et un lien que vous pouvez couper.</li>
        </ul>
        <p className={styles.texte}>
          Depuis Claude, le <a href="/aide/connecteur">connecteur Getgents</a> fait le partage dans la conversation
          (« partage cette page à marie@… »). Avec ChatGPT, Mistral ou tout autre assistant, on colle le code de la page
          dans Getgents. Limites : il faut un compte, l&apos;interface est en français, et un lien vaut 30 jours.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Laquelle choisir ?</h2>
        <ul className={styles.liste}>
          <li>
            <b>Montrer une page, sans attendre de retour</b> : la publication intégrée de Claude.
          </li>
          <li>
            <b>Laisser une copie durable au destinataire</b> : le fichier.
          </li>
          <li>
            <b>Envoyer à une personne précise et recueillir sa réponse</b> (devis, proposition, invitation, compte rendu
            à valider) : un lien privé Getgents Pages.
          </li>
        </ul>
      </section>
    </>
  );
}
