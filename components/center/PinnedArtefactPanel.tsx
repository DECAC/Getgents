"use client";

import { useRef, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { DashboardArtefact } from "@/components/shared/dashboard/DashboardArtefact";
import { extractDocumentText } from "@/lib/extractDocumentText";
import type { PinnedArtefact } from "@/lib/types";
import styles from "./PinnedArtefactPanel.module.css";

function formatWhen(iso?: string): string {
  if (!iso) return "jamais générée";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Artefact figé « mini-app » : rendu proéminent en tête d'espace. L'utilisateur
 * renseigne des entrées limitées (LinkedIn, CV…) puis génère / rafraîchit les
 * données d'un bouton — sans jamais reformuler une instruction.
 */
export function PinnedArtefactPanel({ pinned }: { pinned: PinnedArtefact }) {
  const { refreshPinnedArtefact, updatePinnedInput, pinnedRefreshing, pinnedError } = useEspace();
  const [inputsOpen, setInputsOpen] = useState(!pinned.dashboard);
  const [fileState, setFileState] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const hasData = !!pinned.dashboard;
  const missingInputs = pinned.inputs.some((i) => !i.value?.trim());

  // Entrée « fichier » : on extrait le TEXTE côté navigateur (CV PDF/Word) et on
  // le stocke comme valeur — c'est ce contenu qui nourrit la génération, pas le
  // nom du fichier.
  async function handleFile(inputId: string, file: File | undefined) {
    if (!file) return;
    setFileState((s) => ({ ...s, [inputId]: `Lecture de ${file.name}…` }));
    try {
      const doc = await extractDocumentText(file);
      updatePinnedInput(inputId, `Document « ${doc.name} » :\n${doc.text}`);
      setFileState((s) => ({ ...s, [inputId]: `✓ ${doc.name}${doc.truncated ? " (tronqué)" : ""}` }));
    } catch (e) {
      setFileState((s) => ({ ...s, [inputId]: `⚠ ${(e as Error).message}` }));
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <span className={styles.badge}>Mini-app</span>
          <h2 className={styles.title}>{pinned.title}</h2>
        </div>
        <div className={styles.actions}>
          <span className={styles.when}>Données à jour : {formatWhen(pinned.generatedAt)}</span>
          {pinned.inputs.length > 0 && (
            <button type="button" className={styles.inputsBtn} onClick={() => setInputsOpen((v) => !v)}>
              {inputsOpen ? "Masquer les entrées" : "Entrées"}
            </button>
          )}
          <button
            type="button"
            className={styles.updateBtn}
            onClick={() => refreshPinnedArtefact()}
            disabled={pinnedRefreshing}
            title="Rafraîchir les données de l'artefact"
          >
            {pinnedRefreshing ? (
              <>
                <span className={styles.spinner} aria-hidden="true" /> Mise à jour…
              </>
            ) : hasData ? (
              <>↻ Update</>
            ) : (
              <>✨ Générer</>
            )}
          </button>
        </div>
      </header>

      {inputsOpen && pinned.inputs.length > 0 && (
        <div className={styles.inputs}>
          {pinned.inputs.map((inp) =>
            inp.kind === "file" ? (
              <div key={inp.id} className={styles.inputRow}>
                <span className={styles.inputLabel}>{inp.label}</span>
                <div className={styles.fileRow}>
                  <button
                    type="button"
                    className={styles.fileBtn}
                    onClick={() => fileRefs.current[inp.id]?.click()}
                  >
                    Choisir un fichier
                  </button>
                  <span className={styles.fileState}>
                    {fileState[inp.id] ?? (inp.value ? "✓ document chargé" : "PDF, Word ou texte")}
                  </span>
                  <input
                    ref={(el) => {
                      fileRefs.current[inp.id] = el;
                    }}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className={styles.hiddenFile}
                    onChange={(e) => handleFile(inp.id, e.target.files?.[0])}
                  />
                </div>
              </div>
            ) : (
              <label key={inp.id} className={styles.inputRow}>
                <span className={styles.inputLabel}>{inp.label}</span>
                <input
                  className={styles.input}
                  type={inp.kind === "url" ? "url" : "text"}
                  placeholder={inp.kind === "url" ? "https://…" : "…"}
                  value={inp.value ?? ""}
                  onChange={(e) => updatePinnedInput(inp.id, e.target.value)}
                />
              </label>
            )
          )}
        </div>
      )}

      {pinnedError && <div className={styles.error}>{pinnedError}</div>}

      {hasData ? (
        <div className={styles.body}>
          <DashboardArtefact spec={pinned.dashboard!} />
        </div>
      ) : (
        <div className={styles.empty}>
          <p>
            {missingInputs
              ? "Renseignez les entrées ci-dessus, puis générez votre tableau de bord."
              : "Cliquez sur « Générer » pour produire votre tableau de bord à partir de vos entrées."}
          </p>
        </div>
      )}
    </section>
  );
}
