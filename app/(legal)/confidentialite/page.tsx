import type { Metadata } from "next";
import { EDITEUR, SOUS_TRAITANTS, DERNIERE_REVISION } from "@/lib/legal";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Confidentialité — Getgents",
  description:
    "Quelles données Getgents traite, pourquoi, avec quels sous-traitants, et comment exercer vos droits.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <>
      <h1 className={styles.titre}>Confidentialité</h1>
      <p className={styles.chapeau}>
        Ce texte décrit ce que Getgents fait réellement de vos données. Il est écrit à partir
        du code, pas d&apos;un modèle : chaque service cité correspond à un appel qui existe.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Responsable du traitement</h2>
        <p className={styles.texte}>
          L&apos;éditeur de Getgents, particulier agissant à titre non professionnel (voir{" "}
          <a href="/mentions-legales">les mentions légales</a> et{" "}
          <a href="/a-propos#credits">les crédits</a>), joignable à{" "}
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce que nous conservons</h2>
        <ul className={styles.liste}>
          <li>
            <b>Votre compte</b> : adresse e-mail et mot de passe chiffré, tenus par notre
            prestataire d&apos;authentification.
          </li>
          <li>
            <b>Vos gents</b> : leurs instructions, leur configuration, les documents que vous
            leur confiez et les conversations qu&apos;ils tiennent.
          </li>
          <li>
            <b>Vos pages</b> : le code des pages que vous collez ou partagez, leurs versions
            précédentes, les destinataires (adresse e-mail ou nom) de chaque lien, et les
            précisions que vous donnez à leur assistant.
          </li>
          <li>
            <b>La lecture d&apos;une page partagée</b> : une ouverture anonyme, datée du
            jour, sans nom ni lien. Le détail de la visite (quand, combien de temps,
            partie lue, appareil) n&apos;est transmis que si le lecteur le joint à une
            réponse, en cochant « Joindre ma lecture de la page ». Les questions posées à
            l&apos;assistant de la page sont gardées sans nom ni lien. Les ouvertures et
            les questions sont effacées 120 jours après leur création.
          </li>
          <li>
            <b>La réponse d&apos;un lecteur</b>, s&apos;il clique le bouton que l&apos;auteur lui
            propose : le nom de son lien, l&apos;intitulé du bouton, les choix faits dans la page
            qu&apos;il a laissés cochés, son mot éventuel et, s&apos;il l&apos;a coché, le
            détail de sa lecture — montrés avant l&apos;envoi, une seule réponse par lien. Transmise à l&apos;auteur par e-mail, gardée avec la page et
            effacée avec elle.
          </li>
          <li>
            <b>Vos partages</b> : les adresses que vous invitez, et les liens que vous créez.
          </li>
          <li>
            <b>Votre clé OpenRouter</b>, si vous en branchez une : chiffrée en AES-256-GCM
            avant d&apos;être stockée. Elle ne ressort jamais de la base — l&apos;écran de
            compte n&apos;en affiche que les quatre derniers caractères.
          </li>
          <li>
            <b>Des compteurs d&apos;usage</b> par heure, pour borner la dépense. Ils ne
            contiennent aucun contenu.
          </li>
          <li>
            <b>Les signalements d&apos;incident</b> laissés par les utilisateurs d&apos;un gent
            partagé : vos réponses aux deux questions et, si vous en écrivez, votre description.
            Rien d&apos;autre — ni compte, ni adresse e-mail, ni adresse IP, ni le contenu de
            votre conversation. Ils sont transmis à la personne qui gère le gent, qui n&apos;a
            donc aucun moyen de vous répondre.
          </li>
          <li>
            <b>Les demandes d&apos;accès</b> : l&apos;adresse e-mail et le message laissés dans
            le formulaire de demande, pour pouvoir vous répondre. Ils sont transmis par e-mail
            à l&apos;éditeur, et effacés au bout de 12 mois.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce qui est signalé au créateur d&apos;un gent</h2>
        <p className={styles.texte}>
          Le créateur d&apos;un gent est prévenu par e-mail lorsque quelqu&apos;un se sert
          d&apos;un lien qu&apos;il a partagé — au plus une fois par jour et par lien, et non à
          chaque message. Cette notification indique le gent et le partage concernés.
          <b> Elle ne contient jamais le contenu des échanges</b>, et n&apos;identifie pas
          l&apos;utilisateur : elle dit qu&apos;un lien sert, pas qui s&apos;en sert ni ce
          qu&apos;il demande.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce que nous ne faisons pas</h2>
        <p className={styles.texte}>
          Nous ne vendons aucune donnée. Nous n&apos;utilisons ni publicité ni traceur
          publicitaire, et il n&apos;y a pas de mesure d&apos;audience tierce sur ce site.
          Le contenu de vos gents ne sert pas à entraîner de modèle.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>À qui vos données sont transmises</h2>
        <p className={styles.texte}>
          Faire fonctionner un assistant suppose d&apos;envoyer son contenu au modèle qui
          répond. Voici la liste complète des services concernés.
        </p>
        <ul className={styles.liste}>
          {SOUS_TRAITANTS.map((s) => (
            <li key={s.nom}>
              <b>{s.nom}</b> — {s.role}. {s.donnees}
              {s.optionnel && " Uniquement si le créateur du gent l'active."}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Cookies</h2>
        <p className={styles.texte}>
          Seuls des cookies de session, nécessaires pour vous garder connecté. Aucun cookie
          publicitaire ni de mesure d&apos;audience : c&apos;est pourquoi aucune bannière de
          consentement ne vous est présentée — elle n&apos;aurait rien à demander.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Durée de conservation</h2>
        <p className={styles.texte}>
          Vos données vivent tant que votre compte existe. La suppression du compte, depuis
          la page « Mon compte », efface vos gents, vos brouillons, vos liens de diffusion,
          vos historiques, vos compteurs et votre clé — immédiatement et sans copie de
          secours. Les personnes à qui vous aviez partagé un gent en perdent l&apos;accès.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Vos droits</h2>
        <p className={styles.texte}>
          Vous pouvez accéder à vos données, les rectifier, les effacer, ou vous opposer à
          leur traitement. La suppression est directement à votre main depuis « Mon compte ».
          Pour toute autre demande, écrivez à{" "}
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>. Vous pouvez aussi
          adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </section>

      <p className={styles.note}>Dernière révision : {DERNIERE_REVISION}.</p>
    </>
  );
}
