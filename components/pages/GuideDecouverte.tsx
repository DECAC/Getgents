"use client";

import { useEffect, useState } from "react";
import { etapesDecouverte, type EtatDecouverte } from "@/lib/guideDecouverte";
import styles from "./pages.module.css";

const cleMasque = (pageId: string) => `getgents:guide:${pageId}`;

/**
 * « Découvrez ce que vivra votre lecteur » (18/11) — encadré de la fiche,
 * sur une page d'EXEMPLE ou sur la PREMIÈRE page du compte. Trois étapes,
 * cochées d'après ce qui s'est RÉELLEMENT passé (lien, ouverture, question
 * ou précision), jamais d'après un clic dans le guide. Disparaît quand tout
 * est fait ; « Masquer » le ferme (par page, dans ce navigateur).
 */
export function GuideDecouverte({
  pageId,
  etat,
  moi,
  lienCree,
  enCours,
  onCreerLien,
  onCopierLien,
  onVoirAssistant,
}: {
  pageId: string;
  etat: EtatDecouverte;
  moi: string | null;
  /** Lien du dernier destinataire, pour l'étape 2. */
  lienCree: string | null;
  enCours: boolean;
  onCreerLien: (destinataire: string) => void;
  onCopierLien: (lien: string) => void;
  onVoirAssistant: () => void;
}) {
  const [masque, setMasque] = useState(true);
  const [adresse, setAdresse] = useState(moi ?? "");
  useEffect(() => {
    try {
      setMasque(localStorage.getItem(cleMasque(pageId)) === "masque");
    } catch {
      setMasque(false);
    }
  }, [pageId]);

  const etapes = etapesDecouverte(etat);
  const faites = etapes.filter((e) => e.faite).length;
  if (masque || faites === etapes.length) return null;

  const masquer = () => {
    setMasque(true);
    try {
      localStorage.setItem(cleMasque(pageId), "masque");
    } catch {
      /* rien : le guide reviendra au prochain chargement */
    }
  };

  return (
    <section className={styles.guideDecouverte} aria-label="Découvrez ce que vivra votre lecteur">
      <div className={styles.guideHaut}>
        <span aria-hidden="true">✦</span>
        <b>Découvrez ce que vivra votre lecteur</b>
        <span className={styles.guideEtat}>
          {faites} sur {etapes.length}
          {faites === 0 ? " · 3 minutes" : ""}
        </span>
        <button type="button" className={styles.guideMasquer} onClick={masquer}>
          Masquer ✕
        </button>
      </div>
      <ol className={styles.guideEtapes}>
        {etapes.map((e, i) => (
          <li key={e.cle} className={styles.guideEtape} data-statut={e.faite ? "faite" : e.active ? "active" : "attente"}>
            <h3>
              <span className={styles.guideNum} aria-hidden="true">
                {e.faite ? "✓" : i + 1}
              </span>
              {e.titre}
            </h3>
            <p>{e.texte}</p>
            {e.cle === "lien" && e.active && (
              <form
                className={styles.ligne}
                onSubmit={(ev) => {
                  ev.preventDefault();
                  if (adresse.trim()) onCreerLien(adresse.trim());
                }}
              >
                <input
                  className={styles.champ}
                  value={adresse}
                  onChange={(ev) => setAdresse(ev.target.value)}
                  placeholder="votre@adresse.fr"
                  aria-label="Votre adresse"
                  maxLength={200}
                />
                <button type="submit" className={styles.principal} disabled={!adresse.trim() || enCours}>
                  Créer mon lien
                </button>
              </form>
            )}
            {e.cle === "ouverture" && e.active && lienCree && (
              <div className={styles.ligne}>
                <code className={styles.lienCode}>{lienCree}</code>
                <button type="button" className={styles.secondairePetit} onClick={() => onCopierLien(lienCree)}>
                  Copier le lien
                </button>
              </div>
            )}
            {e.cle === "question" && e.active && etat.questionArrivee && (
              <>
                {etat.questionPiege && <span className={styles.guideQuestion}>{etat.questionPiege}</span>}
                <button type="button" className={styles.principal} onClick={onVoirAssistant}>
                  {etat.exemple ? "Répondre dans l'onglet Assistant" : "Voir dans l'onglet Assistant"}
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {!etapes[1].faite && (
        <p className={styles.guideAstuce}>
          Astuce : Ctrl + Maj + N (Cmd + Maj + N sur Mac) ouvre une fenêtre privée. Sur téléphone, collez le lien dans un autre navigateur. Revenez ensuite
          ici : la fiche se met à jour.
        </p>
      )}
    </section>
  );
}
