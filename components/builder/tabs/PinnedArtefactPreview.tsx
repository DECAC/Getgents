"use client";

import { useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { draftToEspace } from "@/lib/publishedGents";
import { DashboardArtefact } from "@/components/shared/dashboard/DashboardArtefact";
import { extractDocumentText } from "@/lib/extractDocumentText";
import type { DashboardSpec } from "@/lib/dashboardArtefact";
import styles from "./PinnedArtefactPreview.module.css";

/**
 * Aperçu de l'artefact figé DANS le builder, avant publication : le créateur
 * renseigne des entrées d'exemple et génère le tableau de bord réel (même
 * moteur serveur que côté utilisateur : draftToEspace → /api/artefact/preview →
 * refreshPinnedArtefact), sans rien persister. Rendu via DashboardArtefact,
 * exactement comme le verra l'utilisateur final.
 */
export function PinnedArtefactPreview() {
  const { currentDraft } = useBuilder();
  const pinned = currentDraft.pinnedArtefact;

  const [values, setValues] = useState<Record<string, string>>({});
  const [fileState, setFileState] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<DashboardSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!pinned?.enabled) return null;

  async function handleFile(inputId: string, file: File | undefined) {
    if (!file) return;
    setFileState((s) => ({ ...s, [inputId]: `Lecture de ${file.name}…` }));
    try {
      const doc = await extractDocumentText(file);
      setValues((v) => ({ ...v, [inputId]: `Document « ${doc.name} » :\n${doc.text}` }));
      setFileState((s) => ({ ...s, [inputId]: `✓ ${doc.name}${doc.truncated ? " (tronqué)" : ""}` }));
    } catch (e) {
      setFileState((s) => ({ ...s, [inputId]: `⚠ ${(e as Error).message}` }));
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // Espace dérivé du brouillon courant, avec les valeurs d'entrées d'exemple
      // injectées — c'est cet objet que le serveur régénère (parité totale).
      const espace = draftToEspace(currentDraft);
      if (espace.pinnedArtefact) {
        espace.pinnedArtefact = {
          ...espace.pinnedArtefact,
          inputs: espace.pinnedArtefact.inputs.map((i) => ({ ...i, value: values[i.id] ?? i.value })),
        };
      }
      const res = await fetch("/api/artefact/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espace }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        note?: string;
        dashboard?: DashboardSpec | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error === "invalid_espace" ? "Configurez le prompt figé (onglet Prompt)." : `Erreur : ${data.error ?? res.status}`);
      } else if (data.dashboard) {
        setDashboard(data.dashboard);
        if (!data.ok && data.note) setError(`Aperçu partiel : ${data.note}`);
      } else {
        setError(data.note ? `Aperçu impossible : ${data.note}` : "Aucun tableau de bord produit.");
      }
    } catch (e) {
      setError(`Erreur réseau : ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  const missionMissing = !pinned.mission.trim();

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>Aperçu de l&apos;artefact</h4>
          <div className={styles.sub}>
            Renseignez des entrées d&apos;exemple puis générez le rendu réel, tel qu&apos;il
            apparaîtra côté utilisateur.
          </div>
        </div>
        <button
          type="button"
          className={styles.genBtn}
          onClick={generate}
          disabled={loading || missionMissing}
          title={missionMissing ? "Renseignez d'abord le prompt figé (onglet Prompt)" : "Générer l'aperçu"}
        >
          {loading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> Génération…
            </>
          ) : dashboard ? (
            <>↻ Régénérer l&apos;aperçu</>
          ) : (
            <>✨ Générer l&apos;aperçu</>
          )}
        </button>
      </div>

      {missionMissing && (
        <div className={styles.warn}>
          Le « prompt figé » est vide : renseignez la mission dans l&apos;onglet <b>Prompt</b> pour
          pouvoir générer un aperçu.
        </div>
      )}

      {pinned.inputs.length > 0 && (
        <div className={styles.inputs}>
          {pinned.inputs.map((inp) =>
            inp.kind === "file" ? (
              <div key={inp.id} className={styles.inputRow}>
                <span className={styles.inputLabel}>{inp.label || "Entrée"}</span>
                <div className={styles.fileRow}>
                  <button
                    type="button"
                    className={styles.fileBtn}
                    onClick={() => fileRefs.current[inp.id]?.click()}
                  >
                    Choisir un fichier
                  </button>
                  <span className={styles.fileStateLabel}>
                    {fileState[inp.id] ?? (values[inp.id] ? "✓ document chargé" : "PDF, Word ou texte")}
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
                <span className={styles.inputLabel}>{inp.label || "Entrée"}</span>
                <input
                  className={styles.input}
                  type={inp.kind === "url" ? "url" : "text"}
                  placeholder={inp.kind === "url" ? "https://…" : "…"}
                  value={values[inp.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [inp.id]: e.target.value }))}
                />
              </label>
            )
          )}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {dashboard ? (
        <div className={styles.preview}>
          <DashboardArtefact spec={dashboard} />
        </div>
      ) : (
        !loading && (
          <div className={styles.empty}>
            Aucun aperçu pour l&apos;instant — cliquez sur « Générer l&apos;aperçu ».
          </div>
        )
      )}
    </div>
  );
}
