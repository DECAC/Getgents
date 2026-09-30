"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEspace } from "@/lib/context/EspaceContext";
import { MEMOIRE_MAX } from "@/lib/sessionContext";
import styles from "./MemoireGent.module.css";

/**
 * « Ce qu'il sait de moi » : ce que l'utilisateur veut que le gent sache une
 * fois pour toutes — métier, situation, façon de travailler — pour ne plus
 * le redonner à chaque échange.
 *
 * Le champ existait (`memory`, usage de l'espace, joint au prompt par
 * `sessionContextNote`), mais son écran vivait dans l'ancienne coquille,
 * retirée : on ne pouvait plus le remplir. Espace PERSONNEL seulement : un
 * lien de partage ne reçoit jamais la mémoire du créateur, et l'aperçu montre
 * le gent tel qu'un inconnu le voit.
 */
export function MemoireGent() {
  const { currentEspace, updateMemory } = useEspace();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const zoneRef = useRef<HTMLTextAreaElement>(null);
  const rempli = !!currentEspace.memory?.trim();

  useEffect(() => {
    if (!ouvert) return;
    setTexte(currentEspace.memory ?? "");
    zoneRef.current?.focus();
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // Relu à l'ouverture seulement : la saisie en cours ne doit pas être écrasée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        className={[styles.bouton, rempli ? styles.rempli : ""].filter(Boolean).join(" ")}
        onClick={() => setOuvert(true)}
        title="Ce que le gent sait de vous, à chaque échange"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
        <span className={styles.libelle}>Ce qu&apos;il sait de moi</span>
      </button>
      {ouvert &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.voile} onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)}>
            <form
              className={styles.boite}
              role="dialog"
              aria-modal="true"
              aria-labelledby="memoire-titre"
              onSubmit={(e) => {
                e.preventDefault();
                updateMemory(texte.trim().slice(0, MEMOIRE_MAX));
                setOuvert(false);
              }}
            >
              <h2 id="memoire-titre" className={styles.titre}>
                Ce que {currentEspace.gent} sait de moi
              </h2>
              <p className={styles.aide}>
                Votre métier, votre situation, vos objectifs, votre façon d&apos;écrire : le gent en tient
                compte à chaque échange, sans que vous ayez à le redire. Visible de vous seul — jamais
                transmis aux personnes à qui vous partagez ce gent.
              </p>
              <textarea
                ref={zoneRef}
                className={styles.zone}
                value={texte}
                maxLength={MEMOIRE_MAX}
                onChange={(e) => setTexte(e.target.value)}
                placeholder={
                  "Ex. : Je suis directeur des opérations dans une ESN de 300 personnes. Je publie sur LinkedIn " +
                  "pour les dirigeants de PME. Ton direct, tutoiement, pas de jargon. J'ai deux enfants, je cours le marathon."
                }
                rows={9}
              />
              <div className={styles.pied}>
                <span className={styles.compteur}>
                  {texte.length} / {MEMOIRE_MAX}
                </span>
                <button type="button" className={styles.secondaire} onClick={() => setOuvert(false)}>
                  Annuler
                </button>
                <button type="submit" className={styles.principal}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
