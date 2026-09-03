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
        </ul>
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
          <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>

      <p className={styles.note}>Dernière révision : {DERNIERE_REVISION}.</p>
    </>
  );
}
