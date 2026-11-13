"use client";

import { useEffect } from "react";
import type { Consentement } from "@/lib/activitePage";
import styles from "./partage.module.css";

/**
 * « Vos données sur cette page ». Fenêtre par-dessus le document, qui reste
 * chargé (il garde son état). C'est le SEUL endroit où figure le nom de
 * l'auteur ; partout ailleurs, « l'auteur ». L'interrupteur EST le choix.
 */
export default function Confidentialite({
  titre,
  auteur,
  choix,
  protegee,
  onChoix,
  onFermer,
}: {
  titre: string;
  auteur: string | null;
  choix: Consentement | null;
  protegee: boolean;
  onChoix: (c: Consentement) => void;
  onFermer: () => void;
}) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  const partage = choix === "partage";
  return (
    <div className={styles.confVoile} onClick={onFermer}>
      <div className={styles.confBoite} role="dialog" aria-modal="true" aria-labelledby="conf-titre" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.confFermer} aria-label="Fermer" onClick={onFermer}>
          ✕
        </button>
        <h2 id="conf-titre" className={styles.confTitre}>
          Vos données sur cette page
        </h2>
        <p className={styles.confSous}>
          « {titre} »{auteur ? <> · auteur : <b>{auteur}</b>, qui vous l&apos;a envoyée via Getgents.</> : <>, envoyée via Getgents.</>}
        </p>

        <label className={styles.confChoix}>
          <span className={styles.confChoixTexte}>
            <b>Partager mes données avec l&apos;auteur</b>
            <span>
              Actuellement : <b>{partage ? "oui" : "non"}</b> — {partage ? "l'auteur voit votre lecture de cette page." : "votre navigation est anonyme."} Vous
              pouvez changer d&apos;avis à tout moment.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.confBascule}
            checked={partage}
            onChange={(e) => onChoix(e.target.checked ? "partage" : "anonyme")}
          />
        </label>

        <div className={styles.confCols}>
          <div className={styles.confCol} data-ton="bleu">
            <h3>Toujours, sans votre nom</h3>
            <ul>
              <li>Le nombre d&apos;ouvertures de la page, sans dire par qui.</li>
              <li>Les questions posées à l&apos;assistant, sans votre nom ni votre lien, datées du jour seulement. L&apos;auteur s&apos;en sert pour améliorer la page.</li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="vert">
            <h3>Seulement si vous acceptez</h3>
            <ul>
              <li>Quand vous avez ouvert la page, combien de temps, jusqu&apos;où vous l&apos;avez lue.</li>
              <li>Ordinateur ou téléphone.</li>
              <li>Un e-mail à l&apos;auteur à votre première ouverture.</li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="rouge">
            <h3>Jamais</h3>
            <ul>
              <li>Aucune localisation.</li>
              <li>Rien de ce que vous faites hors de cette page.</li>
              <li>Aucune publicité, aucune revente.</li>
            </ul>
          </div>
        </div>

        <h3 className={styles.confSection}>Les réponses de l&apos;assistant</h3>
        <p className={styles.confTexte}>Elles sont produites par une IA, à partir du contenu de cette page. Elles peuvent se tromper et n&apos;engagent pas l&apos;auteur.</p>
        <h3 className={styles.confSection}>Qui traite ces données</h3>
        <p className={styles.confTexte}>
          Getgents héberge la page et l&apos;assistant. Pour répondre, votre question et le texte de la page sont envoyés à un fournisseur de modèles d&apos;IA.
        </p>
        {protegee && (
          <>
            <h3 className={styles.confSection}>Page protégée par code</h3>
            <p className={styles.confTexte}>L&apos;auteur voit que le code envoyé à votre adresse a été validé, et quand : c&apos;est ce qui protège la page.</p>
          </>
        )}
        <h3 className={styles.confSection}>Durée et effacement</h3>
        <p className={styles.confTexte}>
          Tout est effacé 90 jours après l&apos;expiration du lien. Pour un effacement immédiat :{" "}
          <a href="/contact" target="_blank" rel="noopener noreferrer">
            nous écrire
          </a>
          .
        </p>
        <p className={styles.confPied}>
          <a href="/mentions-legales" target="_blank" rel="noopener noreferrer">
            Mentions légales
          </a>
        </p>
      </div>
    </div>
  );
}
