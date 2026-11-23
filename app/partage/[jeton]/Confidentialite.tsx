"use client";

import { useEffect } from "react";
import { textes, type Langue } from "@/lib/langueLecteur";
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
  langue,
}: {
  titre: string;
  auteur: string | null;
  protegee: boolean;
  onFermer: () => void;
  langue: Langue;
}) {
  const t = textes(langue);
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
        <button type="button" className={styles.confFermer} aria-label={t.fermer} onClick={onFermer}>
          ✕
        </button>
        <h2 id="conf-titre" className={styles.confTitre}>
          {t.confTitre}
        </h2>
        <p className={styles.confSous}>
          {auteur ? t.confSousAuteur(titre, auteur) : t.confSous(titre)}
        </p>

        <div className={styles.confCols}>
          <div className={styles.confCol} data-ton="bleu">
            <h3>{t.confToujours}</h3>
            <ul>
              <li>{t.confOuvertures}</li>
              <li>{t.confQuestions}</li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="vert">
            <h3>{t.confSiReponse}</h3>
            <ul>
              <li>{t.confReponse}</li>
              <li>{t.confLecture}</li>
            </ul>
          </div>
          <div className={styles.confCol} data-ton="rouge">
            <h3>{t.confJamais}</h3>
            <ul>
              <li>{t.confLocalisation}</li>
              <li>{t.confHors}</li>
              <li>{t.confPrenom}</li>
              <li>{t.confPub}</li>
            </ul>
          </div>
        </div>

        <h3 className={styles.confSection}>{t.confIaTitre}</h3>
        <p className={styles.confTexte}>{t.confIa}</p>
        <h3 className={styles.confSection}>{t.confQuiTitre}</h3>
        <p className={styles.confTexte}>{t.confQui}</p>
        {protegee && (
          <>
            <h3 className={styles.confSection}>{t.confCodeTitre}</h3>
            <p className={styles.confTexte}>{t.confCode}</p>
          </>
        )}
        <h3 className={styles.confSection}>{t.confDureeTitre}</h3>
        <p className={styles.confTexte}>
          {t.confDuree}{" "}
          <a href="/contact" target="_blank" rel="noopener noreferrer">
            {t.confEcrire}
          </a>
          .
        </p>
        <p className={styles.confPied}>
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer">
            {t.confPolitique}
          </a>{" "}
          ·{" "}
          <a href="/mentions-legales" target="_blank" rel="noopener noreferrer">
            {t.confMentions}
          </a>
        </p>
      </div>
    </div>
  );
}
