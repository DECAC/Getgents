import Link from "next/link";
import styles from "../auth.module.css";
import { libelleAppelAction } from "@/lib/inscriptions";

/**
 * Atterrissage d'un lien d'e-mail qui n'a pas abouti : lien déjà utilisé,
 * expiré, ou ouvert dans un autre navigateur que celui de l'inscription.
 * C'est la situation la plus fréquente et la plus déroutante — l'écran doit
 * dire quoi faire, pas seulement constater l'échec.
 */
export default function ConfirmationPage({
  searchParams,
}: {
  searchParams: { erreur?: string };
}) {
  const echec = !!searchParams.erreur;

  return (
    <>
      <h1 className={styles.title}>{echec ? "Ce lien n'a pas fonctionné" : "Adresse confirmée"}</h1>
      <div className={echec ? styles.erreur : styles.succes}>
        {echec
          ? "Le lien est expiré, ou il a déjà servi. Les liens de confirmation ne sont valables qu'une fois."
          : "Votre compte est actif. Vous pouvez vous connecter."}
      </div>
      <p className={styles.note}>
        {echec
          ? "Reconnectez-vous pour recevoir un nouveau lien. Si vous avez ouvert le lien sur un autre appareil que celui de l'inscription, réessayez depuis le premier."
          : "Bienvenue — vos gents vous attendent."}
      </p>
      <div className={styles.aside}>
        <Link href="/connexion">Aller à la connexion</Link>
        {echec ? <Link href="/inscription">{libelleAppelAction()}</Link> : null}
      </div>
    </>
  );
}
