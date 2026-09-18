"use client";

/**
 * Le plateau d'« Élysée 2027 » — la partie occupe la PAGE.
 *
 * Deux essais précédents ont rendu la mise en scène dans la conversation :
 * d'abord un cartouche dans le bandeau, puis une vraie surface de tour, mais
 * montée dans le tiroir. La typographie était juste, la colonne trois fois
 * trop étroite — et la moitié de l'écran affichait « Par quoi commencer ? ».
 * Une décision présidentielle a besoin de la page entière.
 *
 * Le plateau ne calcule RIEN : l'état vient du moteur déterministe, par
 * `useEtatJeuActif`. Il sait seulement quoi montrer, et dans quel ordre.
 */
import { useEspace } from "@/lib/context/EspaceContext";
import { JumpFormCard } from "@/components/shared/JumpFormCard";
import { BilanJeu, useEtatJeuActif } from "./BandeauJeu";
import { SceneTour } from "./SceneTour";
import styles from "./PlateauJeu.module.css";

/** Le déclencheur d'une partie, quand le gent n'a pas de formulaire. */
const DEMARRAGE = "Nouvelle partie";

export function PlateauJeu() {
  const { currentEspace, sendMessage, isThinking, submitJumpForm } = useEspace();
  const etat = useEtatJeuActif();
  const enTour = !!(etat?.decision || etat?.consequence);

  return (
    <div className={styles.plateau}>
      <div className={styles.colonne}>
        {enTour && etat ? (
          <SceneTour etat={etat} onRepondre={sendMessage} actif={!isThinking} />
        ) : (
          /*
           * Aucune partie en cours. Ce bloc est le SEUL point d'entrée une
           * fois la conversation cachée : sans lui, un gent de jeu s'ouvre et
           * ne se joue pas, sans qu'aucune erreur ne le dise.
           */
          <div className={styles.ouverture}>
            {/* Le formulaire porte déjà sa propre mise en contexte
                (« Vous venez d'être élu(e)… ») : un chapô de plus la
                répéterait. */}
            <h2 className={styles.accroche}>{currentEspace.name}</h2>
            {currentEspace.jumpForm ? (
              <JumpFormCard
                form={currentEspace.jumpForm}
                disabled={isThinking}
                onSubmit={(values) => submitJumpForm(values)}
              />
            ) : (
              <button
                type="button"
                className={styles.demarrer}
                disabled={isThinking}
                onClick={() => sendMessage(DEMARRAGE)}
              >
                {DEMARRAGE}
              </button>
            )}
          </div>
        )}

        {/* L'analyse en pied : on va la chercher au lieu de la subir. */}
        {etat && (
          <section className={styles.pied} aria-label="Situation du mandat">
            <BilanJeu etat={etat} />
          </section>
        )}
      </div>
    </div>
  );
}
