"use client";

import { useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { extractDocumentForViewer } from "@/lib/documentViewer";
import styles from "./PromptTab.module.css";

/**
 * Type de gent « visionneuse » : à l'inverse du bouton « Ouvrir en
 * visionneuse » du gent conversationnel (document choisi par l'utilisateur, à
 * l'usage, parmi d'autres artefacts possibles), ici le créateur fixe LE
 * document une fois pour toutes — l'espace s'ouvre directement en lecture
 * immersive, et la conversation reste scopée à ce document (jamais l'un OU
 * l'autre).
 */
export function VisionneuseTab() {
  const { currentDraft, updateVisionneuse } = useBuilder();
  const visionneuse = currentDraft.visionneuse;
  const enabled = !!visionneuse?.enabled;
  const doc = visionneuse?.document;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(`Extraction de ${file.name}…`);
    try {
      const spec = await extractDocumentForViewer(file);
      updateVisionneuse({ document: spec });
      setBusy(null);
    } catch (err) {
      setBusy(`⚠ ${(err as Error).message}`);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Type « Visionneuse »</h4>
            <div className={styles.sub}>
              Le gent s&apos;ouvre directement en lecture immersive plein écran sur UN document que
              vous fixez ici — pas de choix entre conversation et visionneuse : la conversation
              reste possible, mais toujours au service de la compréhension de ce document (sommaire,
              résumés, artefacts d&apos;appui).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className={[styles.switch, enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateVisionneuse({ enabled: !enabled })}
            aria-label="Activer le type Visionneuse"
          >
            <span className={styles.knob} />
          </button>
        </div>

        {enabled && (
          <>
            {doc ? (
              <div className={styles.knowList}>
                <div className={styles.knowRow}>
                  <div className={styles.knowIc}>📖</div>
                  <div className={styles.knowInfo}>
                    <div className={styles.knowLabel}>{doc.sourceName}</div>
                    <div className={styles.knowMeta}>
                      {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""}
                      {doc.toc.length > 0 ? ` · ${doc.toc.length} entrées de sommaire` : " · sans sommaire détecté"}
                      {doc.truncated ? " · tronqué" : ""}
                    </div>
                  </div>
                  <button
                    className={styles.knowRemove}
                    onClick={() => updateVisionneuse({ document: undefined })}
                    aria-label="Retirer le document"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.knowBusy}>Aucun document attaché — la visionneuse ne peut pas s&apos;ouvrir sans lui.</div>
            )}

            {busy && <div className={styles.knowBusy}>{busy}</div>}

            <div className={styles.knowAddRow}>
              <button type="button" className={styles.knowAddBtn} onClick={() => fileInputRef.current?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
                {doc ? "Remplacer le document" : "Attacher un document"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                className={styles.hiddenFileInput}
              />
            </div>

            <div className={styles.routineConfig}>
              <textarea
                className={styles.routineMission}
                value={visionneuse?.instructions ?? ""}
                onChange={(e) => updateVisionneuse({ instructions: e.target.value })}
                placeholder={
                  "Consignes pour l'assistant qui accompagne la lecture : angle à privilégier, ton, ce qu'il doit proposer spontanément (résumés de section, artefacts d'appui…). Ex. : Aide le lecteur à naviguer ce rapport annuel — résume chaque partie sur demande, propose un tableau de bord des chiffres clés si utile."
                }
                aria-label="Consignes de l'assistant de la visionneuse"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
