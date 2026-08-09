"use client";

import { useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { STARTER_COUNT } from "@/lib/starterSignal";
import type { Espace } from "@/lib/types";
import styles from "./StarterBubbles.module.css";

/** Largeurs variées pour que l'attente préfigure le rang de bulles à venir. */
const SKELETON_WIDTHS = ["46%", "32%", "40%", "28%", "36%"];

/**
 * « Déclencheurs » — l'espace de travail d'un gent tout juste ouvert est vide,
 * et ne dit donc rien de ce qu'on peut lui demander. Ces cinq bulles, choisies
 * par le gent d'après sa propre configuration, remplacent la page blanche par
 * des exemples cliquables : un clic déploie la conversation et pose la
 * question, l'utilisateur découvre les usages en voyant le gent répondre.
 */
export function StarterBubbles({ espace }: { espace: Espace }) {
  const { runStarter, ensureStarters, isThinking, shareMode, storageReady } = useEspace();
  const starters = espace.starters ?? [];

  useEffect(() => {
    // Le destinataire d'un lien de partage ne déclenche jamais de génération :
    // il lit ceux que le créateur a déjà fait produire, sinon rien. Sans ça,
    // chaque visite d'un lien coûterait un appel au modèle.
    if (shareMode) return;
    // On attend la fin de l'hydratation : la synchronisation initiale remplace
    // l'espace entier quand elle se termine, et effacerait des déclencheurs
    // écrits avant elle.
    if (!storageReady) return;
    ensureStarters();
  }, [ensureStarters, shareMode, storageReady]);

  const loading = starters.length === 0 && !shareMode;

  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>{espace.icon}</div>

      <div className={styles.intro}>
        <h2 className={styles.title}>Par quoi commencer&nbsp;?</h2>
        <p className={styles.sub}>
          {loading
            ? "Votre gent prépare quelques exemples de ce que vous pouvez lui demander…"
            : starters.length
              ? "Choisissez une question pour lancer la conversation — ou ouvrez l’assistant et formulez la vôtre."
              : "Ouvrez la conversation : les artefacts produits par votre assistant apparaîtront ici, librement organisables."}
        </p>
      </div>

      {loading && (
        <div className={styles.bubbles} aria-hidden="true">
          {SKELETON_WIDTHS.slice(0, STARTER_COUNT).map((width, i) => (
            <div key={i} className={styles.skeleton} style={{ width }} />
          ))}
        </div>
      )}

      {starters.length > 0 && (
        <div className={styles.bubbles}>
          {starters.map((question) => (
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
