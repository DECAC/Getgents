import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured } from "@/lib/authConfig";
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

export default async function ComptePage() {
  if (!isAuthConfigured()) redirect("/builder/mesgents");
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
