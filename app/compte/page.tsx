import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured, missingAuthEnvVars, unconfiguredPolicy } from "@/lib/authConfig";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import CleOpenRouter, { type EtatCle } from "@/components/compte/CleOpenRouter";
import Consommation from "@/components/compte/Consommation";
import Identifiants from "@/components/compte/Identifiants";
import ZoneSensible from "@/components/compte/ZoneSensible";
import styles from "./compte.module.css";

/**
 * Réglages du compte.
 *
 * Reste un composant SERVEUR : `getUser()` s'appuie sur `cookies()`, hors de
 * portée du navigateur. Il passe des props sérialisables à des composants
 * clients ciblés — et jamais la clé OpenRouter, dont seul l'indice descend
 * jusqu'ici.
 *
 * Pas de liste de gents sur cette page, délibérément : `/builder/mesgents`
 * fusionne déjà les gents possédés et ceux partagés avec le compte. En
 * dupliquer une seconde version créerait deux vérités, dont une périmée.
 */
export const dynamic = "force-dynamic";

const ETAT_VIDE: EtatCle = {
  present: false,
  hint: null,
  derniereReussite: null,
  derniereErreur: null,
};

async function lireEtatCle(userId: string): Promise<EtatCle> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return ETAT_VIDE;

  // On ne sélectionne PAS `ciphertext` : ce qui n'est pas lu ne peut pas se
  // retrouver par accident dans le HTML rendu.
  const { data } = await supabase
    .from("user_api_keys")
    .select("hint, last_ok_at, last_error")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return ETAT_VIDE;
  return {
    present: true,
    hint: (data.hint as string) ?? null,
    derniereReussite: (data.last_ok_at as string) ?? null,
    derniereErreur: (data.last_error as string) ?? null,
  };
}

/**
 * Écran affiché quand l'authentification n'est pas configurée.
 *
 * Cette page redirigeait vers `/builder/mesgents`. Depuis cette page-là, on
 * partait et on revenait aussitôt : un aller-retour instantané, impossible à
 * distinguer d'un lien mort. Le symptôme a coûté une recherche de bug là où il
 * manquait une variable d'environnement.
 *
 * Une page qui ne peut pas faire son travail doit le DIRE. Et le dire à qui
 * peut agir : en développement on nomme les variables manquantes, en
 * production on reste générique — la personne qui verrait cet écran sur un
 * site ouvert n'est pas forcément son exploitant, et lui réciter la
 * configuration du serveur ne l'aiderait pas. Le détail part dans les
 * journaux, où l'exploitant le trouvera.
 */
function ConfigurationManquante({ variables }: { variables: string[] }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Mon compte</h1>
      <section className={styles.bloc}>
        <h2 className={styles.sousTitre}>Indisponible</h2>
        <p className={styles.aide}>
          Les comptes ne sont pas activés sur cette installation : cette page ne peut donc
          rien afficher.
        </p>
        {variables.length > 0 && (
          <p className={styles.aide}>
            Variables d&apos;environnement manquantes :{" "}
            {variables.map((v, i) => (
              <span key={v}>
                {i > 0 && ", "}
                <code>{v}</code>
              </span>
            ))}
            . Définissez-les puis redéployez.
          </p>
        )}
        <p className={styles.retour}>
          <Link href="/builder/mesgents">← Revenir à mes gents</Link>
        </p>
      </section>
    </main>
  );
}

export default async function ComptePage() {
  if (!isAuthConfigured()) {
    const manquantes = missingAuthEnvVars();
    console.error(
      JSON.stringify({
        tag: "getgents:auth",
        event: "compte_non_configure",
        missing: manquantes,
      })
    );
    // En production, le détail reste dans le journal ci-dessus.
    const enProduction = unconfiguredPolicy(process.env.NODE_ENV) === "bloquer";
    return <ConfigurationManquante variables={enProduction ? [] : manquantes} />;
  }

  const user = await getUser();
  if (!user) redirect("/connexion?next=/compte");

  const etatCle = await lireEtatCle(user.id);

  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Mon compte</h1>

      <CleOpenRouter initial={etatCle} />
      <Consommation />
      <Identifiants email={user.confirmedEmail} />

      <section className={styles.bloc}>
        <h2 className={styles.sousTitre}>Mes gents</h2>
        <p className={styles.aide} style={{ marginBottom: 0 }}>
          Vos gents et ceux qu'on a partagés avec vous sont réunis sur{" "}
          <Link href="/builder/mesgents">la page Mes gents</Link>.
        </p>
      </section>

      <ZoneSensible email={user.confirmedEmail} />

      <p className={styles.retour}>
        <Link href="/builder/mesgents">← Revenir à mes gents</Link>
      </p>
    </main>
  );
}
