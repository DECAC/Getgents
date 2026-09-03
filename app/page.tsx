import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured } from "@/lib/authConfig";
import styles from "./accueil-public.module.css";
import { libelleAppelAction } from "@/lib/inscriptions";
import { PiedLegal } from "@/components/shared/PiedLegal";

/**
 * Racine du site.
 *
 * Elle redirigeait en dur vers `/espace/voyage` — un espace de démonstration,
 * qui n'a de sens pour personne d'autre que le prototype. Elle devient le
 * point d'entrée réel : une présentation pour qui arrive sans compte, et le
 * renvoi vers ses gents pour qui en a un.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  // Sans Supabase (développement local, mode maquette), on garde le
  // comportement d'avant : personne n'est attendu à la connexion.
  if (!isAuthConfigured()) redirect("/builder/mesgents");

  const user = await getUser();
  if (user) redirect("/builder/mesgents");

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.mark}>G</span>
        <h1 className={styles.titre}>Vos agents, construits par vous.</h1>
        <p className={styles.lede}>
          Décrivez ce dont vous avez besoin, et Getgents en fait un gent : un assistant qui
          connaît vos documents, interroge vos sources et produit ce que vous lui demandez.
          Gardez-le pour vous, partagez-le à qui vous voulez, ou publiez-le.
        </p>
        <div className={styles.actions}>
          {/* Le libellé suit l'ouverture des inscriptions : promettre « créer un
              compte » quand la création est fermée fait perdre son temps. */}
          <Link href="/inscription" className={styles.primaire}>
            {libelleAppelAction()}
          </Link>
          <Link href="/connexion" className={styles.secondaire}>
            Se connecter
          </Link>
        </div>
      </section>
      <PiedLegal />
    </main>
  );
}
