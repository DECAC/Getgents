"use client";

import { useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { documentsDisponiblesDuBrouillon } from "@/lib/fileDownload";
import { draftToEspace, readPublishedGents, writePublishedGent } from "@/lib/publishedGents";
import { espaceForRoutineRun, formatApiNetworkError, mergeRoutineRunResult } from "@/lib/espaceApiPayload";
import { ArtefactExamples } from "./ArtefactExamples";
import styles from "./PromptTab.module.css";

/**
 * Gent conversationnel : ce qui lui est propre en dialogue — recherche web,
 * routine planifiée, téléchargement de fichiers, artefacts produits.
 *
 * Le prompt et les modèles ont quitté cet onglet pour « Configuration du gent
 * → Prompt & Modèle » : ils valent pour TOUS les types de gent, et personne ne
 * pensait à les chercher derrière un libellé qui nomme un type. Les
 * connaissances vivent au même endroit, la mini-application sous son onglet.
 */
export function ConversationnelTab() {
  const {
    currentDraft,
    toggleWebSearch,
    updateFileDownload,
    updateRoutine,
  } = useBuilder();
  const disponibles = documentsDisponiblesDuBrouillon(currentDraft);
  // `undefined` veut dire « tous » : on le déplie en cases cochées, sinon le
  // créateur verrait une liste vide alors que tout est proposé, et croirait
  // devoir cocher ce qui l'est déjà.
  const selection = currentDraft.fileDownloadSelection ?? disponibles.map((d) => d.id);

  const [routineRunning, setRoutineRunning] = useState(false);
  const [routineRunResult, setRoutineRunResult] = useState<string | null>(null);

  // Run forcé de la routine (test) : le serveur exécute la mission sur le gent
  // PUBLIÉ (état en base) et écrit le résultat dans son espace.
  async function handleRunRoutineNow() {
    setRoutineRunning(true);
    setRoutineRunResult(null);
    try {
      const full = readPublishedGents()[currentDraft.id] ?? draftToEspace(currentDraft);
      const res = await fetch("/api/routines/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gentId: currentDraft.id, espace: espaceForRoutineRun(full) }),
      });
      const data = (await res.json()) as {
        results?: { status: string; espace?: ReturnType<typeof draftToEspace> }[];
        error?: string;
        persisted?: boolean;
      };
      if (!res.ok) {
        setRoutineRunResult(
          data.error === "supabase_not_configured"
            ? "Impossible d'exécuter : publiez d'abord le gent, puis réessayez."
            : `Erreur : ${data.error ?? res.status}`
        );
      } else {
        const result = data.results?.[0];
        const status = result?.status ?? "aucun gent trouvé (publiez d'abord)";
        if (result?.espace) writePublishedGent(currentDraft.id, mergeRoutineRunResult(full, result.espace));
        const localNote = data.persisted === false ? " (enregistré localement)" : "";
        setRoutineRunResult(`Run terminé : ${status}${localNote}. Ouvrez l'espace utilisateur pour voir la note.`);
        if (status.startsWith("ok")) updateRoutine({ lastRunNote: status });
      }
    } catch (e) {
      setRoutineRunResult(formatApiNetworkError(e));
    } finally {
      setRoutineRunning(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Recherche web</h4>
            <div className={styles.sub}>
              Autorise ce gent à consulter le web en temps réel pour compléter ses réponses
              (résultats récents, sources citées).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!currentDraft.webSearch}
            className={[styles.switch, currentDraft.webSearch ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={toggleWebSearch}
            aria-label="Activer la recherche web"
          >
            <span className={styles.knob} />
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Routine planifiée</h4>
            <div className={styles.sub}>
              Le gent exécute une mission automatiquement (veille, note quotidienne…), même sans
              personne en ligne — le résultat arrive dans l&apos;espace utilisateur. Actif après
              publication.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!currentDraft.routine?.enabled}
            className={[styles.switch, currentDraft.routine?.enabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateRoutine({ enabled: !currentDraft.routine?.enabled })}
            aria-label="Activer la routine planifiée"
          >
            <span className={styles.knob} />
          </button>
        </div>
        {currentDraft.routine?.enabled && (
          <div className={styles.routineConfig}>
            <div className={styles.routineRow}>
              <label className={styles.routineLabel} htmlFor="routine-freq">
                Fréquence
              </label>
              <select
                id="routine-freq"
                className={styles.routineSelect}
                value={currentDraft.routine.frequency}
                onChange={(e) => updateRoutine({ frequency: e.target.value as "daily" | "weekly" })}
              >
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines</option>
              </select>
              <label className={styles.routineLabel} htmlFor="routine-hour">
                à partir de
              </label>
              <select
                id="routine-hour"
                className={styles.routineSelect}
                value={currentDraft.routine.hour}
                onChange={(e) => updateRoutine({ hour: parseInt(e.target.value, 10) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")} h
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className={styles.routineMission}
              value={currentDraft.routine.mission}
              onChange={(e) => updateRoutine({ mission: e.target.value })}
              placeholder={
                "Mission exécutée à chaque déclenchement. Ex. : Scanne les offres d'emploi et l'actualité du marché correspondant au profil de l'utilisateur, et produis une note du jour (dashboard : offres pertinentes, signaux marché, conseils)."
              }
              aria-label="Mission de la routine"
            />
            <div className={styles.routineFoot}>
              <span className={styles.routineStatus}>
                {currentDraft.routine.lastRunNote
                  ? `Dernier run : ${currentDraft.routine.lastRunNote}`
                  : "Jamais exécutée"}
              </span>
              {currentDraft.status === "published" && (
                <button
                  type="button"
                  className={styles.routineRunBtn}
                  disabled={routineRunning || !currentDraft.routine.mission.trim()}
                  onClick={handleRunRoutineNow}
                >
                  {routineRunning ? "Exécution…" : "▶ Exécuter maintenant"}
                </button>
              )}
            </div>
            {routineRunResult && <div className={styles.routineResult}>{routineRunResult}</div>}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div className={styles.capabilityHead}>
            <span className={styles.capabilityIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <div>
              <h4 className={styles.title}>Permettre le téléchargement de fichiers</h4>
              <div className={styles.sub}>
                Le lecteur peut télécharger le document du gent (connaissances ou visionneuse) au
                format PDF. Sans cette option, aucun bouton n&apos;apparaît. Pour un lien de
                diffusion, cliquez ensuite sur <b>Diffuser les modifications</b> — Preview ne
                suffit pas.
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!currentDraft.fileDownloadEnabled}
            className={[styles.switch, currentDraft.fileDownloadEnabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updateFileDownload({ fileDownloadEnabled: !currentDraft.fileDownloadEnabled })}
            aria-label="Permettre le téléchargement de fichiers"
          >
            <span className={styles.knob} />
          </button>
        </div>
        {currentDraft.fileDownloadEnabled && (
          <div className={styles.subOption}>
            <div>
              <div className={styles.subOptionTitle}>Formulaire de téléchargement</div>
              <div className={styles.sub}>
                Avant le PDF, demander le nom, le prénom et l&apos;e-mail, plus un captcha
                « Vous n&apos;êtes pas un robot ». Seules les personnes qui valident ce
                formulaire et téléchargent apparaissent dans Monitor → Marketing.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!currentDraft.fileDownloadFormEnabled}
              className={[styles.switch, currentDraft.fileDownloadFormEnabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
              onClick={() =>
                updateFileDownload({ fileDownloadFormEnabled: !currentDraft.fileDownloadFormEnabled })
              }
              aria-label="Activer le formulaire de téléchargement"
            >
              <span className={styles.knob} />
            </button>
          </div>
        )}

        {currentDraft.fileDownloadEnabled && (
          <div className={styles.subOption} style={{ display: "block" }}>
            <div className={styles.subOptionTitle}>Documents proposés</div>
            <div className={styles.sub}>
              Cochez ce que le lecteur pourra télécharger. Sans sélection explicite, tous les
              documents lisibles du gent sont proposés.
            </div>

            {disponibles.length === 0 ? (
              /* Le téléchargement est actif mais il n'y a rien à télécharger. Dire
                 pourquoi vaut mieux qu'une liste vide : le créateur croirait à une
                 panne alors qu'il lui manque une étape. */
              <p className={styles.sub}>
                Aucun document lisible pour l&apos;instant. Ajoutez un fichier dans{" "}
                <b>Configuration du gent → Connaissances</b>, ou activez une visionneuse : seuls
                les documents dont le texte a pu être extrait peuvent devenir un PDF.
              </p>
            ) : (
              <>
                <ul className={styles.docList}>
                  {disponibles.map((doc) => {
                    const coche = selection.includes(doc.id);
                    return (
                      <li key={doc.id}>
                        <label className={styles.docItem}>
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={() =>
                              updateFileDownload({
                                fileDownloadSelection: coche
                                  ? selection.filter((id) => id !== doc.id)
                                  : [...selection, doc.id],
                              })
                            }
                          />
                          <span className={styles.docNom}>{doc.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {selection.length === 0 && (
                  /* État muet s'il en est : le bouton de téléchargement
                     n'apparaîtra pas côté lecteur, et rien ne le dirait. */
                  <p className={styles.docAvertissement}>
                    Aucun document coché : le lecteur ne verra aucun bouton de téléchargement.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.sectionHead}>
        <h4 className={styles.title}>Artefacts produits en conversation</h4>
        <div className={styles.sub}>
          Formats que le gent peut générer spontanément au fil de l&apos;échange. Rien à activer :
          tous sont éligibles, le modèle choisit seul le moment pertinent.
        </div>
      </div>
      <ArtefactExamples />
    </div>
  );
}