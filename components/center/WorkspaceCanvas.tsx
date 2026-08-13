"use client";

import { AppPreview } from "@/components/appPreview/AppPreview";
import { useEspace } from "@/lib/context/EspaceContext";
import {
  activeConversationMessageCount,
  shouldShowConversationStarters,
} from "@/lib/starterSignal";
import { ModuleCanvas } from "./ModuleCanvas";
import { StarterBubbles } from "./StarterBubbles";
import type { Espace } from "@/lib/types";
import styles from "./WorkspaceCanvas.module.css";

/**
 * Canevas de l'espace : le nouveau rendu (onglets + modules à blocs) dès
 * qu'un aperçu a été généré dans le studio, sinon l'ancien canevas
 * d'artefacts — pour que Preview montre la même application que l'onglet
 * Aperçu, et que les gents sans aperçu continuent de fonctionner.
 *
 * Les déclencheurs d'amorce vivaient sur le canevas vide. L'aperçu le remplit,
 * donc on les recolle en bandeau tant que la conversation n'a pas commencé
 * (et dans le panneau assistant une fois ouvert).
 */
export function WorkspaceCanvas({ espace }: { espace: Espace }) {
  const { assistantOpen, runStarter } = useEspace();

  if (espace.appPreview?.modules.length) {
    const showStarters =
      shouldShowConversationStarters(espace, activeConversationMessageCount(espace)) && !assistantOpen;

    return (
      <div className={styles.withPreview}>
        <div className={styles.preview}>
          <AppPreview spec={espace.appPreview} variant="workspace" onAsk={runStarter} />
        </div>
        {showStarters && (
          <div className={styles.startersDock}>
            <StarterBubbles espace={espace} variant="compact" />
          </div>
        )}
      </div>
    );
  }

  return <ModuleCanvas espace={espace} />;
}
