"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { DUREE_PAR_DEFAUT, DUREES_CIBLES, motsCibles } from "@/lib/prompteur";
import styles from "./PromptTab.module.css";

/**
 * Type de gent « Le Prompteur » : la conversation écrit une capsule vidéo,
 * un bouton sous la réponse la lance dans le prompteur, qui défile au rythme
 * de la voix et enregistre la vidéo. Voir lib/prompteur.ts.
 */
export function PrompteurTab() {
  const { currentDraft, updatePrompteur } = useBuilder();
  const prompteur = currentDraft.prompteur;
  const enabled = !!prompteur?.enabled;
  const duree = prompteur?.dureeCible ?? DUREE_PAR_DEFAUT;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Type « Le Prompteur »</h4>
            <div className={styles.sub}>
              Le gent écrit avec vous le texte d&apos;une capsule vidéo à partir d&apos;une idée ou
              d&apos;un thème. Une fois le texte validé, un bouton « Prompteur » sous sa réponse le
              garde dans l&apos;espace et l&apos;ouvre en lecture : le texte défile au rythme de votre
              voix, et la caméra enregistre la capsule.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className={[styles.switch, enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updatePrompteur({ enabled: !enabled })}
            aria-label="Activer le type Prompteur"
          >
            <span className={styles.knob} />
          </button>
        </div>

        {enabled && (
          <div className={styles.routineConfig}>
            <div className={styles.routineRow}>
              <label className={styles.routineLabel} htmlFor="prompteur-duree">
                Durée visée de la capsule
              </label>
              <select
                id="prompteur-duree"
                className={styles.routineSelect}
                value={duree}
                onChange={(e) => updatePrompteur({ dureeCible: parseInt(e.target.value, 10) })}
              >
                {DUREES_CIBLES.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} secondes` : d === 60 ? "1 minute" : "1 min 30"} — environ {motsCibles(d)} mots
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {enabled && (
        <div className={styles.card}>
          <h4 className={styles.title}>Bon à savoir</h4>
          <div className={styles.tips}>
            <div className={styles.tip}>
              <span aria-hidden="true">🎙</span>
              <span>
                <b>Suivre ma voix</b> utilise la reconnaissance vocale du navigateur (Chrome, Edge,
                Safari), qui peut transcrire la voix sur les serveurs de son éditeur (Google pour
                Chrome, Apple pour Safari) le temps de la lecture. Ailleurs, ou si vous préférez, le
                texte avance quand vous parlez et s&apos;arrête quand vous vous taisez, sans rien
                transcrire.
              </span>
            </div>
            <div className={styles.tip}>
              <span aria-hidden="true">🎬</span>
              <span>
                La vidéo est enregistrée dans le navigateur et téléchargée sur l&apos;appareil : elle
                ne passe jamais par Getgents. Format MP4 quand le navigateur le permet (Safari,
                Chrome récent), WebM sinon.
              </span>
            </div>
            <div className={styles.tip}>
              <span aria-hidden="true">✍️</span>
              <span>
                Le ton se règle dans « Prompt &amp; Modèle » ; la forme d&apos;une capsule (accroche,
                phrases courtes, chute) est fixée par Getgents.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
