import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured } from "@/lib/authConfig";
import styles from "./compte.module.css";

/**
 * Écran de compte. Volontairement minimal à ce stade : il portera au fil des
 * lots les gents partagés avec moi (lot 7) et la clé OpenRouter personnelle
 * (lot 8).
 */
export const dynamic = "force-dynamic";

export default async function ComptePage() {
  if (!isAuthConfigured()) redirect("/builder/mesgents");
  const user = await getUser();
  if (!user) redirect("/connexion?next=/compte");

  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Mon compte</h1>

      <section className={styles.bloc}>
        <h2 className={styles.sousTitre}>Identifiants</h2>
        <dl className={styles.liste}>
          <dt>Adresse e-mail</dt>
          <dd>{user.confirmedEmail ?? "adresse non confirmée"}</dd>
        </dl>
        <p className={styles.note}>
          Pour changer de mot de passe, passez par{" "}
          <Link href="/mot-de-passe-oublie">le lien de réinitialisation</Link> : il vous
          enverra un e-mail.
        </p>
      </section>

      <p className={styles.retour}>
        <Link href="/builder/mesgents">← Revenir à mes gents</Link>
      </p>
    </main>
  );
}
