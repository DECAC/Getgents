"use client";

import type { Offre } from "@/lib/offre";
import styles from "./pages.module.css";

/**
 * Écran d'un compte SANS page : les deux façons d'en créer une. Coller le
 * code marche avec tous les assistants ; le connecteur est plus rapide
 * ensuite, mais demande un réglage dans Claude — d'où l'ordre.
 */
export function AccueilPages({ offre, onNouvelle }: { offre: Offre; onNouvelle: () => void }) {
  return (
    <section className={styles.accueil}>
      <h1 className={styles.accueilTitre}>{offre === "pages" ? "Bienvenue sur Getgents Pages" : "Créez votre première page"}</h1>
      <p className={styles.accueilLede}>
        Une page, c&apos;est un artefact créé avec Claude ou ChatGPT, partagé à votre client par un lien privé. Vous voyez ce qu&apos;il a lu, et un
        assistant répond à ses questions sur la page.
      </p>
      <div className={styles.chemins}>
        <div className={styles.chemin}>
          <h2>Coller le code d&apos;un artefact</h2>
          <p>Dans Claude ou ChatGPT, bouton « Copier » sur l&apos;artefact, puis collez-le ici. Marche avec tous les assistants.</p>
          <ol>
            <li>Copier l&apos;artefact</li>
            <li>Le coller, vérifier l&apos;aperçu</li>
            <li>Choisir les destinataires</li>
          </ol>
          <button type="button" className={styles.principal} onClick={onNouvelle}>
            + Nouvelle page
          </button>
        </div>
        <div className={`${styles.chemin} ${styles.cheminReco}`}>
          <span className={styles.cheminTag}>Le plus rapide ensuite</span>
          <h2>Partager depuis Claude</h2>
          <p>Une fois le connecteur ajouté, dites simplement à Claude : « partage cette page à marie@acme.fr ».</p>
          <ol>
            <li>Ajouter le connecteur Getgents dans Claude</li>
            <li>Autoriser votre compte</li>
            <li>Demander le partage dans la conversation</li>
          </ol>
          <a href="/pages?guide=1" className={styles.secondaire} style={{ textDecoration: "none" }}>
            Connecter Claude
          </a>
        </div>
      </div>
      <ul className={styles.atouts}>
        <li>Lien privé par destinataire</li>
        <li>Accès protégé par code</li>
        <li>Ce qu&apos;a lu le client</li>
        <li>Assistant IA</li>
      </ul>
    </section>
  );
}
