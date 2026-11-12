"use client";

import { useEffect, useState } from "react";
import AssistantDocument from "./AssistantDocument";
import styles from "./partage.module.css";

/** La bulle « Une question sur ce document ? » ne s'affiche qu'une fois par navigateur. */
const CLE_BULLE = "getgents:partage:bulleVue";
const DELAI_BULLE_MS = 3000;

/**
 * Corps de la page d'un partage : le cadre de l'artefact et, s'il est activé,
 * l'assistant du document.
 *
 * Replié (à l'arrivée) : le document prend toute la page, un bouton flottant
 * en bas à droite l'annonce. Ouvert : document et assistant deviennent deux
 * cartes DÉTACHÉES côte à côte, le document se resserre — on consulte en
 * posant ses questions. Sous 1 000 px, l'assistant passe au-dessus du
 * document ; sur téléphone, il occupe la moitié basse et le document reste
 * utilisable au-dessus.
 *
 * Le cadre n'est JAMAIS démonté : changer sa taille ne le recharge pas,
 * l'artefact garde son état. L'assistant non plus : replier garde le fil.
 */
export default function VuePartage({
  jeton,
  titre,
  assistant,
  amorces,
  bandeau,
}: {
  jeton: string;
  titre: string;
  assistant: boolean;
  amorces: string[];
  bandeau: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [agrandi, setAgrandi] = useState(false);
  const [bulle, setBulle] = useState(false);

  useEffect(() => {
    if (!assistant) return;
    let vue = false;
    try {
      vue = localStorage.getItem(CLE_BULLE) === "1";
    } catch {
      /* stockage fermé : la bulle s'affiche, c'est sans gravité */
    }
    if (vue) return;
    const t = window.setTimeout(() => {
      setBulle(true);
      try {
        localStorage.setItem(CLE_BULLE, "1");
      } catch {
        /* rien */
      }
    }, DELAI_BULLE_MS);
    return () => window.clearTimeout(t);
  }, [assistant]);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  const ouvrir = () => {
    setBulle(false);
    setOuvert(true);
  };
  const fermer = () => {
    setOuvert(false);
    setAgrandi(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.bandeau}>{bandeau}</header>
      <div className={styles.corps} data-ouvert={assistant && ouvert ? "oui" : "non"} data-agrandi={agrandi ? "oui" : "non"}>
        <iframe
          className={styles.cadre}
          src={`/api/partage/${encodeURIComponent(jeton)}/contenu`}
          title={titre}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
        />
        {assistant && (
          <AssistantDocument
            jeton={jeton}
            amorces={amorces}
            ouvert={ouvert}
            agrandi={agrandi}
            onFermer={fermer}
            onAgrandir={() => setAgrandi((a) => !a)}
          />
        )}
      </div>

      {assistant && !ouvert && (
        <>
          {bulle && (
            <div className={styles.bulle} role="status">
              <button type="button" className={styles.bulleFermer} aria-label="Masquer" onClick={() => setBulle(false)}>
                ✕
              </button>
              <b>Une question sur ce document ?</b>
              L&apos;assistant y répond, à partir du document seulement.
            </div>
          )}
          <button type="button" className={styles.lanceur} onClick={ouvrir} aria-label="Ouvrir l'assistant du document">
            <span className={styles.lanceurEtoile} aria-hidden="true">
              ✦
            </span>
            Poser une question
          </button>
        </>
      )}
    </div>
  );
}
