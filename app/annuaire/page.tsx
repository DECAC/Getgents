import type { Metadata } from "next";
import Link from "next/link";
import { listerAnnuaire } from "@/lib/server/publicGent";
import styles from "./annuaire.module.css";
import { libelleAppelAction } from "@/lib/inscriptions";

/**
 * Annuaire des gents publics.
 *
 * Rendu côté serveur, sans compte requis : c'est une page d'entrée pour les
 * moteurs de recherche autant que pour les visiteurs, et chaque fiche pointe
 * vers l'adresse racine du gent.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annuaire des gents · Getgents",
  description:
    "Les assistants publiés sur Getgents : des agents créés par leurs utilisateurs, ouverts à tous.",
  robots: { index: true, follow: true },
};

export default async function AnnuairePage() {
  const gents = await listerAnnuaire().catch(() => []);

  return (
    <main className={styles.page}>
      <div className={styles.contenu}>
        <header className={styles.entete}>
          <h1 className={styles.titre}>Les gents publics</h1>
          <p className={styles.lede}>
            Des assistants créés sur Getgents et ouverts à tous. Chacun a sa propre adresse.
          </p>
        </header>

        {gents.length === 0 ? (
          <p className={styles.vide}>
            Aucun gent public pour l&apos;instant.{" "}
            <Link href="/inscription">{libelleAppelAction()}</Link> pour créer le vôtre.
          </p>
        ) : (
          <ul className={styles.grille}>
            {gents.map((g) => (
              <li key={g.slug}>
                <Link href={`/${g.slug}`} className={styles.carte}>
                  <span className={styles.icone} aria-hidden="true">
                    {g.icone}
                  </span>
                  <span className={styles.nom}>{g.nom}</span>
                  {g.resume ? <span className={styles.resume}>{g.resume}</span> : null}
                  <span className={styles.adresse}>/{g.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
