"use client";

import Link from "next/link";
import styles from "./SessionExpiree.module.css";

/**
 * Remplace l'ancien `AppAccessPrompt`, qui demandait de coller un secret
 * d'instance à la main.
 *
 * Un 401 ne se corrige plus en saisissant une clé : il veut dire que la
 * session a expiré, et la seule chose à faire est de se reconnecter. Proposer
 * un champ à remplir laisserait croire le contraire.
 */
export function SessionExpiree({ next }: { next?: string }) {
  const destination = next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion";
  return (
    <div className={styles.bloc} role="alert">
      <p className={styles.titre}>Votre session a expiré</p>
      <p className={styles.texte}>
        Reconnectez-vous pour retrouver vos gents. Rien n&apos;est perdu : votre travail est
        enregistré sur votre compte.
      </p>
      <Link href={destination} className={styles.bouton}>
        Se reconnecter
      </Link>
    </div>
  );
}
