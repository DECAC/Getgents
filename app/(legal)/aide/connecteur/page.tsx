import type { Metadata } from "next";
import { EDITEUR } from "@/lib/legal";
import { PLAFONDS_PAGES } from "@/lib/offre";
import { ADRESSE_MCP, EXEMPLES_DEMANDES, OUTILS_PUBLICS, RESUME_EN, RESUME_FR } from "@/lib/connecteurPublic";
import styles from "../../legal.module.css";

/**
 * Documentation PUBLIQUE du connecteur MCP — exigée par l'annuaire des
 * connecteurs de Claude, lue par les moteurs et les IA. Le texte vient de
 * `lib/connecteurPublic.ts` : une seule source avec `llms.txt` et la fiche
 * du registre.
 */
export const metadata: Metadata = {
  title: "Connecteur Getgents Pages pour Claude",
  description: RESUME_FR,
  alternates: { canonical: "/aide/connecteur" },
};

export default function ConnecteurPage() {
  return (
    <>
      <h1 className={styles.titre}>Le connecteur Getgents Pages pour Claude</h1>
      <p className={styles.chapeau}>{RESUME_FR}</p>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Ce que fait le connecteur</h2>
        <ul className={styles.liste}>
          <li>
            <b>Un lien privé par destinataire</b> : la page s&apos;ouvre en plein écran, sans compte, pendant 30 jours.
          </li>
          <li>
            <b>Un accès par code</b>, si vous l&apos;activez : un code à usage unique part à l&apos;adresse du destinataire.
          </li>
          <li>
            <b>La réponse du lecteur</b> : un bouton que vous intitulez (« Je souhaite donner suite », « Je viens »…) ; les
            cases cochées dans la page sont jointes à sa réponse.
          </li>
          <li>
            <b>Un assistant</b>, si vous l&apos;activez : il répond aux questions du lecteur à partir de la page, et dit
            quand la page ne contient pas la réponse.
          </li>
          <li>
            <b>Des versions</b> : corrigez la page, tous ses liens montrent la nouvelle version.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>L&apos;ajouter à Claude</h2>
        <ol className={styles.liste}>
          <li>
            Dans Claude : Paramètres → Connecteurs → Ajouter un connecteur personnalisé, avec l&apos;adresse{" "}
            <code>{ADRESSE_MCP}</code>.
          </li>
          <li>Claude ouvre une page Getgents : connectez-vous et cliquez « Autoriser ».</li>
          <li>Dans une conversation, demandez par exemple « partage cette page à marie@… ».</li>
        </ol>
        <p className={styles.texte}>
          Il faut un compte Getgents (<a href="/inscription">inscription ou demande d&apos;accès</a>). L&apos;interface et
          les pages de lecture sont en français. Sans connecteur, vous pouvez aussi coller le code d&apos;un artefact ou
          d&apos;un canvas dans Getgents : ça marche avec n&apos;importe quel assistant.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Exemples de demandes</h2>
        <ul className={styles.liste}>
          {EXEMPLES_DEMANDES.map((e) => (
            <li key={e}>« {e} »</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Les outils</h2>
        <dl className={styles.dl}>
          {OUTILS_PUBLICS.map((o) => (
            <div key={o.nom} style={{ display: "contents" }}>
              <dt>
                <code>{o.nom}</code> · {o.nature}
              </dt>
              <dd>
                <b>{o.titre}.</b> {o.role}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Données et sécurité</h2>
        <ul className={styles.liste}>
          <li>
            Le connecteur reçoit ce que Claude lui transmet : le titre et le contenu de la page, son format, le
            destinataire (adresse e-mail ou nom) et, facultativement, un mot d&apos;accompagnement. Il ne lit ni vos
            conversations, ni vos autres artefacts.
          </li>
          <li>
            La page est affichée dans un cadre isolé, sur un domaine séparé : son code n&apos;a accès ni aux cookies, ni
            au stockage, ni à la page Getgents qui l&apos;entoure.
          </li>
          <li>
            Connexion par OAuth (PKCE). Jetons d&apos;accès valables une heure ; les codes et jetons ne sont gardés
            qu&apos;en empreinte. Pour retirer l&apos;accès, déconnectez le connecteur dans Claude.
          </li>
          <li>
            Limites d&apos;un compte : {PLAFONDS_PAGES.pages} pages, {PLAFONDS_PAGES.liensActifs} liens actifs,{" "}
            {PLAFONDS_PAGES.questionsParMois} questions à l&apos;assistant par mois.
          </li>
          <li>
            Détail des données traitées : <a href="/confidentialite">confidentialité</a>. Règles d&apos;usage :{" "}
            <a href="/cgu">conditions d&apos;utilisation</a>.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Aide</h2>
        <p className={styles.texte}>
          Une question, un problème : <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>

      <section className={styles.section} lang="en">
        <h2 className={styles.sousTitre}>In English</h2>
        <p className={styles.texte}>{RESUME_EN}</p>
        <p className={styles.texte}>
          Add it in Claude: Settings → Connectors → Add custom connector, URL <code>{ADRESSE_MCP}</code>, then sign in to
          Getgents and click « Autoriser » (Authorize). Requires a Getgents account. The interface and the reader pages
          are in French. Tools: <code>partager_page</code> (share a page), <code>mettre_a_jour_page</code> (update it),{" "}
          <code>lister_partages</code> (list your links, read-only), <code>revoquer_partage</code> (revoke a link,
          destructive). Support: <a href={`mailto:${EDITEUR.contact}`}>{EDITEUR.contact}</a>.
        </p>
      </section>
    </>
  );
}
