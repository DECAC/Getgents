import { redirect } from "next/navigation";
import { adresseAvecParametres, presentationClient, validerDemande } from "@/lib/oauthMcp";
import { lireClient } from "@/lib/server/oauthMcp";
import { getUser } from "@/lib/server/session";
import { isAuthConfigured } from "@/lib/authConfig";
import Consentement from "./Consentement";
import styles from "../../auth.module.css";

/**
 * Consentement du connecteur MCP. Claude y envoie le commercial ; le
 * middleware l'a déjà fait passer par /connexion s'il n'avait pas de session
 * (`/oauth/` est un chemin privé). La page dit QUI demande (nom déclaré par
 * l'application) et OÙ partira l'accès (le site de l'adresse de retour) :
 * le nom se choisit librement à l'inscription, le site non.
 */
export const dynamic = "force-dynamic";

export default async function AutoriserPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const p = Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const client = await lireClient(p.client_id);
  const v = validerDemande(p, client);

  if (!v.ok && "afficher" in v) {
    return (
      <>
        <h1 className={styles.title}>Connexion impossible</h1>
        <div className={styles.erreur}>{v.afficher}</div>
      </>
    );
  }
  if (!v.ok) {
    const r = v.renvoyer;
    redirect(adresseAvecParametres(r.adresseRetour, { error: r.erreur, error_description: r.description, state: r.state }));
  }

  const user = await getUser();
  // Développement local sans Supabase : le parcours reste exerçable (compte « dev-local »).
  const compte = user?.confirmedEmail ?? (isAuthConfigured() ? "votre compte" : "compte de développement");
  const { nom, site } = presentationClient(client!, v.demande.adresseRetour);

  return (
    <>
      <h1 className={styles.title}>Autoriser {nom}</h1>
      <p className={styles.lede}>
        <strong>{nom}</strong> demande à partager des pages en votre nom, depuis <strong>{site}</strong>.
      </p>
      <ul className={styles.liste}>
        <li>Publier une page (un artefact, un canvas) que vous lui demandez de partager, et vous rendre le lien privé.</li>
        <li>Chaque partage est rattaché à votre compte ({compte}).</li>
      </ul>
      <p className={styles.note}>
        Il ne lit ni vos gents, ni vos conversations, ni vos e-mails, et n&apos;envoie aucun message : c&apos;est vous qui
        transmettez le lien.
      </p>
      <Consentement parametres={p as Record<string, string>} />
      <p className={styles.note}>Si vous n&apos;êtes pas à l&apos;origine de cette demande, refusez.</p>
    </>
  );
}
