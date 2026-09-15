"use client";

import { AppPreview } from "@/components/appPreview/AppPreview";
import { useEspace } from "@/lib/context/EspaceContext";
import {
  activeConversationMessageCount,
  shouldShowConversationStarters,
} from "@/lib/starterSignal";
import { keptArtefactModuleId, withKeptArtefacts } from "@/lib/workspaceArtefacts";
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
 * Les artefacts gardés (« Garder dans l'espace ») sont greffés sur l'aperçu :
 * sans cela ils étaient enregistrés mais invisibles derrière la maquette studio.
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
    const newest = espace.artefacts[0];
    const spec = withKeptArtefacts(espace.appPreview, espace.artefacts);

    return (
      <div className={styles.withPreview}>
        <div className={styles.preview}>
          <AppPreview
            spec={spec}
            variant="workspace"
            onAsk={runStarter}
            artefacts={espace.artefacts}
            focusTheme={newest?.type}
            highlightModuleId={newest ? keptArtefactModuleId(newest.id) : undefined}
          />
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
