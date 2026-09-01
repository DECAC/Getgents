import type { GentPublic } from "@/lib/server/publicGent";
import styles from "./GentPublicVitrine.module.css";

/**
 * Gent public dont la conversation n'est PAS ouverte aux visiteurs.
 *
 * La page existe quand même, et c'est voulu : elle est indexable, elle donne
 * une adresse à partager, et elle dit ce que fait le gent. Elle est rendue
 * côté serveur, sans JavaScript nécessaire — un moteur de recherche y voit le
 * texte directement.
 */
export function GentPublicVitrine({ gent }: { gent: GentPublic }) {
  const { espace, resume } = gent;

  return (
    <main className={styles.page}>
      <article className={styles.carte}>
        <div className={styles.icone} aria-hidden="true">
          {espace.icon}
        </div>
        <h1 className={styles.titre}>{espace.name}</h1>
        {espace.gent ? <p className={styles.sousTitre}>{espace.gent}</p> : null}
        {resume ? <p className={styles.resume}>{resume}</p> : null}

        {espace.starters?.length ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitre}>Ce qu&apos;on peut lui demander</h2>
            <ul className={styles.liste}>
              {espace.starters.slice(0, 5).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className={styles.note}>
          Ce gent est consultable, mais son créateur n&apos;a pas ouvert la conversation aux
          visiteurs.
        </p>

        <a href="/inscription" className={styles.cta}>
          Créer mon propre gent
        </a>
      </article>
    </main>
  );
}
