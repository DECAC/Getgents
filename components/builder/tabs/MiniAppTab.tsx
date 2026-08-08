"use client";

import { useEffect, useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { PinnedArtefactConfig } from "./PinnedArtefactConfig";
import { PinnedArtefactPreview } from "./PinnedArtefactPreview";
import styles from "./PromptTab.module.css";

/**
 * Mode mini-application : le gent ne converse pas, il produit un tableau de
 * bord permanent que l'utilisateur rafraîchit d'un bouton à partir d'entrées
 * limitées. L'activation, la mission, les entrées et l'aperçu vivent ici —
 * auparavant éclatés entre l'onglet Prompt et l'onglet Artefacts.
 */
export function MiniAppTab() {
  const { currentDraft, updatePinnedArtefact } = useBuilder();

  const pinnedEnabled = !!currentDraft.pinnedArtefact?.enabled;
  const pinnedMission = currentDraft.pinnedArtefact?.mission ?? "";

  // Valeur locale découplée des re-rendus du contexte (ex. streaming de
  // l'assistant du builder) : sans ça, chaque frappe pouvait interrompre une
  // composition de caractère accentué en cours.
  const [missionValue, setMissionValue] = useState(pinnedMission);
  const missionPushedRef = useRef(pinnedMission);

  useEffect(() => {
    if (pinnedMission !== missionPushedRef.current) {
      setMissionValue(pinnedMission);
      missionPushedRef.current = pinnedMission;
    }
  }, [pinnedMission]);

  function handleMissionChange(text: string) {
    setMissionValue(text);
    missionPushedRef.current = text;
    updatePinnedArtefact({ mission: text });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Mode mini-application</h4>
            <div className={styles.sub}>
              Transforme le gent en mini-app : au lieu de converser, l&apos;utilisateur fournit des
              entrées puis génère un tableau de bord. Le texte ci-dessous décrit ce que la mini-app
              produit à chaque génération — distinct des instructions système du gent
              conversationnel.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pinnedEnabled}
            className={[styles.switch, pinnedEnabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updatePinnedArtefact({ enabled: !pinnedEnabled })}
            aria-label="Activer la mini-application"
          >
            <span className={styles.knob} />
          </button>
        </div>
        {pinnedEnabled && (
          <div className={styles.routineConfig}>
            <textarea
              className={styles.routineMission}
              value={missionValue}
              onChange={(e) => handleMissionChange(e.target.value)}
              placeholder={
                "Décris le tableau de bord à produire à chaque génération : sections, indicateurs clés, tableaux… Ex. : Analyse le profil et produis un tableau de bord carrière — diagnostic de positionnement, opportunités classées par fit, réseau, actions prioritaires."
              }
              aria-label="Instruction de génération de la mini-app"
            />
          </div>
        )}
      </div>

      <PinnedArtefactConfig />
      <PinnedArtefactPreview />
    </div>
  );
}
