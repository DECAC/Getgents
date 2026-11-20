import Link from "next/link";
import { BrandIcon } from "@/components/shared/BrandMark";
import { PiedLegal } from "@/components/shared/PiedLegal";
import { libelleAppelAction, type EtatInscriptions } from "@/lib/inscriptions";
import { PLAFONDS_PAGES } from "@/lib/offre";
import styles from "./VitrinePages.module.css";

/**
 * Vitrine de getgents.ai (18/11, décision de l'éditeur) : la racine présente
 * GETGENTS PAGES, seul produit ouvert au public. Elle présentait les gents,
 * qui ne le sont pas : le visiteur demandait un accès aux gents et recevait
 * Pages. Les gents diffusés restent à leur adresse (`/<nom>`).
 *
 * Promesse volontairement LARGE (clients, équipe, proches) : l'essai doit
 * dire quels usages viennent, pas les présupposer — la demande d'accès
 * demande « avec qui, et quoi ».
 *
 * Formulations à garder EXACTES, elles décrivent le produit tel qu'il est :
 * l'assistant répond « à partir de la page » (jamais « uniquement » : les
 * précisions de l'auteur s'y ajoutent) ; on voit qu'une page est OUVERTE, le
 * détail de lecture seulement si le lecteur l'accepte.
 */
export function VitrinePages({ inscriptions = { genre: "fermees" } }: { inscriptions?: EtatInscriptions }) {
  const appel = libelleAppelAction(inscriptions);
  const ouvertes = inscriptions.genre === "ouvertes";
  return (
    <div className={styles.page}>
      <header className={styles.barre}>
        <Link href="/" className={styles.marque}>
          <BrandIcon size={32} />
          Getgents Pages
        </Link>
        <nav className={styles.nav} aria-label="Navigation">
          <a className={styles.lienLarge} href="#comment">Comment ça marche</a>
          <a className={styles.lienLarge} href="#essai">Accès</a>
          <Link className={styles.lienLarge} href="/connexion">Se connecter</Link>
          <Link className={`${styles.btn} ${styles.primaire} ${styles.petit}`} href="/inscription">
            {appel}
          </Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div>
            <span className={styles.etiquette}>
              {ouvertes ? "Essai gratuit" : "Accès sur invitation · gratuit pendant l'essai"}
            </span>
            <h1 className={styles.titre}>
              Ce que vous créez avec l&apos;IA, envoyé à la bonne personne, par un lien privé.
            </h1>
            <p className={styles.lede}>
              Une proposition pour un client, un compte rendu pour votre équipe, un programme pour
              vos proches : elle le consulte sans compte, pose ses questions à un assistant qui
              répond à partir de la page, puis vous donne sa réponse d&apos;un clic.
            </p>
            <div className={styles.actions}>
              <Link className={`${styles.btn} ${styles.primaire}`} href="/inscription">
                {appel}
              </Link>
              <a className={`${styles.btn} ${styles.secondaire}`} href="#comment">
                Voir comment ça marche
              </a>
            </div>
            <p className={styles.note}>
              Déjà un compte ? <Link href="/connexion">Se connecter</Link>
            </p>
          </div>

          {/* Illustration : une page partagée et son assistant. Décor, pas une capture. */}
          <div className={styles.sceneCadre} aria-hidden="true">
            <div className={styles.scene}>
              <div className={styles.sceneHaut}>
                <BrandIcon size={18} />
                <b>Proposition — Acme</b>
                <span className={styles.sceneDate}>· mis à jour le 12 nov.</span>
                <span className={styles.verrou}>🔒 Réservé à marie@acme.fr</span>
              </div>
              <div className={styles.sceneCorps}>
                <div className={styles.doc}>
                  <p className={styles.docTitre}>Proposition — Acme</p>
                  <p className={styles.docSous}>Refonte du parcours client · 3 lots</p>
                  <div className={styles.ligne}><span>Lot 1 — Audit</span><span>12 000 €</span></div>
                  <div className={styles.ligne}><span>Lot 2 — Conception</span><span>18 500 €</span></div>
                  <div className={styles.ligne}><span>Lot 3 — Déploiement</span><span>16 000 €</span></div>
                  <div className={styles.total}><span>Total HT</span><span>46 500 €</span></div>
                  <div className={styles.barres}>
                    {[40, 65, 100, 55, 30].map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} className={i === 2 ? styles.barreForte : undefined} />
                    ))}
                  </div>
                </div>
                <div className={styles.assist}>
                  <p className={styles.assistTitre}>✦ Questions sur la page</p>
                  <p className={styles.q}>Le lot 3 peut-il commencer en janvier ?</p>
                  <p className={styles.r}>
                    La page prévoit le lot 3 après la conception, soit à partir de mars. Elle ne dit
                    pas s&apos;il peut être avancé : je vous conseille de poser la question à
                    l&apos;auteur.
                  </p>
                  <p className={styles.saisie}>Posez une question sur ce document…</p>
                </div>
              </div>
            </div>
            <div className={styles.vu}>
              <b>Ouverte aujourd&apos;hui · 3 questions</b>
              <span>Marie a répondu « Je souhaite donner suite », lecture jointe</span>
            </div>
          </div>
        </section>

        <section className={styles.section} id="comment">
          <h2 className={styles.h2}>Comment ça marche</h2>
          <p className={styles.intro}>
            Vous gardez votre outil d&apos;IA. Getgents s&apos;occupe du lien, de l&apos;accès et
            de ce qui se passe après l&apos;envoi.
          </p>
          <ol className={styles.etapes}>
            <li className={styles.carte}>
              <h3>Créez avec votre IA</h3>
              <p>
                Demandez à Claude, ChatGPT ou Mistral le document dont vous avez besoin :
                proposition, compte rendu, programme…
              </p>
              <div className={styles.outils}>
                <span>Claude</span><span>ChatGPT</span><span>Mistral</span><span>Perplexity</span>
              </div>
            </li>
            <li className={styles.carte}>
              <h3>Faites-en une page</h3>
              <p>
                Collez le code de l&apos;artefact dans Getgents, ou demandez directement à Claude :
                « partage cette page à marie@acme.fr ».
              </p>
            </li>
            <li className={styles.carte}>
              <h3>Envoyez le lien</h3>
              <p>
                Un lien privé par destinataire, que vous envoyez vous-même. Corrigez la page : le
                lien montre toujours la dernière version.
              </p>
            </li>
          </ol>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Ce que votre lecteur reçoit, et ce que vous en apprenez</h2>
          <p className={styles.intro}>Une page soignée, rien à installer, aucun compte à créer.</p>
          <div className={styles.atouts}>
            <div className={styles.atout}>
              <span className={styles.ic}>🔗</span>
              <div>
                <h3>Un lien privé par destinataire</h3>
                <p>
                  Révocable à tout moment. Si vous le souhaitez, un code envoyé à l&apos;adresse du
                  destinataire protège l&apos;accès : un lien transféré ne s&apos;ouvre plus.
                </p>
              </div>
            </div>
            <div className={styles.atout}>
              <span className={styles.ic}>✦</span>
              <div>
                <h3>Un assistant sur la page</h3>
                <p>
                  Votre lecteur pose ses questions, l&apos;assistant répond à partir du document.
                  Quand la page ne dit rien, il le dit, et vous voyez la question pour compléter.
                </p>
              </div>
            </div>
            <div className={styles.atout}>
              <span className={styles.ic}>👁</span>
              <div>
                <h3>Savoir si la page a été ouverte</h3>
                <p>
                  Ouvertures du jour, questions posées. Le détail de lecture (durée, partie lue)
                  seulement si votre lecteur accepte de le partager, en vous répondant.
                </p>
              </div>
            </div>
            <div className={styles.atout}>
              <span className={styles.ic}>↻</span>
              <div>
                <h3>Des versions, sans renvoyer de pièce jointe</h3>
                <p>
                  Chaque correction crée une version. Les anciennes restent restaurables, le lien ne
                  change pas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Pour qui</h2>
          <p className={styles.intro}>
            Pour tout document qui mérite mieux qu&apos;une pièce jointe ou une capture
            d&apos;écran.
          </p>
          <div className={styles.publics}>
            <div className={styles.carte}>
              <span className={styles.ic}>💼</span>
              <h3>Vos clients</h3>
              <p>
                Propositions commerciales, devis, présentations. Vous savez si elles ont été
                ouvertes, et ce qu&apos;elles soulèvent comme questions.
              </p>
            </div>
            <div className={styles.carte}>
              <span className={styles.ic}>👥</span>
              <h3>Votre équipe</h3>
              <p>
                Comptes rendus, tableaux de bord, plans d&apos;action. Chacun pose ses questions à
                la page au lieu de relancer un fil de messages.
              </p>
            </div>
            <div className={styles.carte}>
              <span className={styles.ic}>🏡</span>
              <h3>Vos proches</h3>
              <p>
                Programme d&apos;un voyage, budget d&apos;un projet, dossier à transmettre. Un lien
                privé, sans compte à créer pour personne.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="essai">
          <div className={styles.essai}>
            <div>
              <h2 className={styles.h2}>Un accès d&apos;essai, gratuit</h2>
              <p className={styles.intro}>
                {inscriptions.genre === "ouvertes"
                  ? "Créez votre compte en une minute : l'essai est gratuit."
                  : inscriptions.genre === "completes"
                    ? "Les inscriptions sont momentanément fermées. Laissez votre adresse : nous vous écrirons dès qu'elles rouvrent."
                    : "Getgents Pages ouvre sur invitation. Dites-nous en deux lignes avec qui vous voulez partager, et quoi : nous vous envoyons votre accès par e-mail."}
              </p>
              <Link className={`${styles.btn} ${styles.primaire}`} href="/inscription">
                {appel}
              </Link>
            </div>
            <ul className={styles.plafonds}>
              <li><span>Pages</span><b>{PLAFONDS_PAGES.pages}</b></li>
              <li><span>Liens actifs</span><b>{PLAFONDS_PAGES.liensActifs}</b></li>
              <li><span>Questions à l&apos;assistant</span><b>{PLAFONDS_PAGES.questionsParMois} / mois</b></li>
              <li><span>Prix</span><b>Gratuit pendant l&apos;essai</b></li>
            </ul>
          </div>
        </section>
      </main>

      <PiedLegal />
    </div>
  );
}
