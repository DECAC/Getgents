"use client";

import { useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { STARTER_COUNT, displayedStarters } from "@/lib/starterSignal";
import type { Espace } from "@/lib/types";
import styles from "./StarterBubbles.module.css";

/** Largeurs variées pour que l'attente préfigure le rang de bulles à venir. */
const SKELETON_WIDTHS = ["46%", "32%", "40%", "28%", "36%"];

/**
 * « Déclencheurs » — questions d'amorce cliquables, choisies par le gent.
 *
 * `canvas` : page blanche de l'ancien canevas (titre + squelettes le temps
 * de la génération). `compact` : bandeau sous l'aperçu d'application, ou
 * accueil du panneau conversation — on affiche tout de suite un repli
 * (onglets / nom du gent) plutôt qu'une attente vide.
 */
export function StarterBubbles({
  espace,
  variant = "canvas",
}: {
  espace: Espace;
  variant?: "canvas" | "compact";
}) {
  const { runStarter, ensureStarters, isThinking, storageReady } = useEspace();
  const generated = espace.starters ?? [];
  const questions = variant === "compact" ? displayedStarters(espace) : generated;
  const loading = variant === "canvas" && generated.length === 0;

  useEffect(() => {
    // On attend la fin de l'hydratation : la synchronisation initiale remplace
    // l'espace entier quand elle se termine, et effacerait des déclencheurs
    // écrits avant elle. (En mode partage il n'y a pas d'hydratation locale :
    // storageReady est vrai d'emblée.)
    if (!storageReady) return;
    ensureStarters();
  }, [ensureStarters, storageReady]);

  return (
    <div className={[styles.wrap, variant === "compact" ? styles.compact : ""].filter(Boolean).join(" ")}>
      {variant === "canvas" && <div className={styles.icon}>{espace.icon}</div>}

      <div className={styles.intro}>
        <h2 className={styles.title}>Par quoi commencer&nbsp;?</h2>
        {variant === "canvas" && (
          <p className={styles.sub}>
            {loading
              ? "Votre gent prépare quelques exemples de ce que vous pouvez lui demander…"
              : generated.length
                ? "Choisissez une question pour lancer la conversation — ou ouvrez l’assistant et formulez la vôtre."
                : "Ouvrez la conversation : les artefacts produits par votre assistant apparaîtront ici, librement organisables."}
          </p>
        )}
        {variant === "compact" && (
          <p className={styles.sub}>Choisissez une question — ou écrivez la vôtre dans la conversation.</p>
        )}
      </div>

      {loading && (
        <div className={styles.bubbles} aria-hidden="true">
          {SKELETON_WIDTHS.slice(0, STARTER_COUNT).map((width, i) => (
            <div key={i} className={styles.skeleton} style={{ width }} />
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div className={styles.bubbles}>
          {questions.map((question) => (
            <button
              key={question}
              type="button"
              className={styles.bubble}
              onClick={() => runStarter(question)}
              disabled={isThinking}
              title={isThinking ? "Une réponse est en cours de génération" : "Poser cette question au gent"}
            >
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
