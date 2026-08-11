"use client";

import { useRef, useState, useEffect } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { draftToEspace, readPublishedGents, writePublishedGent } from "@/lib/publishedGents";
import { espaceForRoutineRun, formatApiNetworkError, mergeRoutineRunResult } from "@/lib/espaceApiPayload";
import { ModelsTab } from "./ModelsTab";
import { ArtefactExamples } from "./ArtefactExamples";
import styles from "./PromptTab.module.css";

/**
 * Gent conversationnel : tout ce qui définit son comportement en dialogue.
 * Les connaissances (transverses avec la mini-app) vivent sous « Contexte »,
 * et le mode mini-application sous son propre onglet.
 */
export function ConversationnelTab() {
  const {
    currentDraft,
    updateSystemPrompt,
    toggleWebSearch,
    updateRoutine,
  } = useBuilder();
  const wordCount = currentDraft.systemPrompt.trim().split(/\s+/).filter(Boolean).length;
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

  // Valeur locale découplée des re-rendus du contexte (ex. streaming de
  // l'assistant du builder) : sans ça, chaque frappe pouvait interrompre une
  // composition de caractère accentué en cours (le navigateur reset le champ
  // au milieu d'une séquence de touche morte), donnant des accents mangés.
  const [promptValue, setPromptValue] = useState(currentDraft.systemPrompt);
  const lastPushedRef = useRef(currentDraft.systemPrompt);

  useEffect(() => {
    setPromptValue(currentDraft.systemPrompt);
    lastPushedRef.current = currentDraft.systemPrompt;
  }, [currentDraft.id, currentDraft.systemPrompt]);

  function handlePromptChange(text: string) {
    setPromptValue(text);
    lastPushedRef.current = text;
    updateSystemPrompt(text);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Instructions système (prompt)</h4>
        <div className={styles.sub}>
          Ce texte définit le comportement du gent en production. Décrivez son rôle, ses règles
          impératives (ex. invariants de sécurité) et le ton attendu — l&apos;assistant du builder
          peut vous aider à le rédiger.
        </div>
        <textarea
          className={styles.promptArea}
          value={promptValue}
          onChange={(e) => handlePromptChange(e.target.value)}
          placeholder={
            "Tu es [nom du gent] de Getgents.\n\nObjectif : ...\n\nRègles impératives :\n- ...\n- ..."
          }
          aria-label="Prompt système du gent"
        />
        <div className={styles.footRow}>
          <span>{wordCount} mot{wordCount !== 1 ? "s" : ""}</span>
          <span>Modifiable à tout moment — versionné à chaque publication</span>
        </div>
      </div>

      <div className={styles.sectionHead}>
        <h4 className={styles.title}>Modèles</h4>
        <div className={styles.sub}>
          Le modèle utilisé par ce gent se choisit directement ici, capacité par capacité (voir
          ci-dessous).
        </div>
      </div>
      <ModelsTab />

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
        <h4 className={styles.title}>Bonnes pratiques</h4>
        <div className={styles.tips}>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Formulez l&apos;objectif premier en une phrase claire avant les règles de détail.
          </div>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Explicitez les invariants non négociables (ex. « jamais de paiement autonome »).
          </div>
          <div className={styles.tip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Précisez quand mettre à jour la mémoire et quels artefacts générer.
          </div>
        </div>
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