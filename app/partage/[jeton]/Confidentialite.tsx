"use client";

import { useEffect } from "react";
import styles from "./partage.module.css";

/**
 * « Vos données sur cette page ». Fenêtre par-dessus le document, qui reste
 * chargé (il garde son état). C'est le SEUL endroit où figure le nom de
 * l'auteur ; partout ailleurs, « l'auteur ». Plus d'interrupteur (19/11) :
 * la lecture est anonyme, son détail ne part qu'avec une réponse, si le
 * lecteur coche « Joindre ma lecture ».
 */
export default function Confidentialite({
  titre,
  auteur,
  protegee,
  onFermer,
}: {
  titre: string;
  auteur: string | null;
  protegee: boolean;
  onFermer: () => void;
}) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

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

        <div className={styles.confCols}>
          <div className={styles.confCol} data-ton="bleu">
            <h3>Toujours, sans votre nom</h3>
            <ul>
              <li>Le nombre d&apos;ouvertures de la page, sans dire par qui.</li>
              <li>Les questions posées à l&apos;assistant, sans votre nom ni votre lien, datées du jour seulement. L&apos;auteur s&apos;en sert pour améliorer la page.</li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="vert">
            <h3>Seulement si vous répondez</h3>
            <ul>
              <li>
                Si l&apos;auteur propose un bouton de réponse et que vous le cliquez : votre nom, les choix que vous laissez cochés et votre mot,
                montrés avant l&apos;envoi.
              </li>
              <li>
                Votre lecture de cette visite (quand, combien de temps, jusqu&apos;où, ordinateur ou téléphone), seulement si vous cochez « Joindre ma
                lecture de la page ». Elle est mesurée dans la page et n&apos;en sort pas autrement.
              </li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="rouge">
            <h3>Jamais</h3>
            <ul>
              <li>Aucune localisation.</li>
              <li>Rien de ce que vous faites hors de cette page.</li>
              <li>Sur un lien de groupe, le prénom que vous choisissez reste sur cet appareil ; il ne part qu&apos;avec votre réponse.</li>
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
