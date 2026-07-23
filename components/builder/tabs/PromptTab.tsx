"use client";

import { useRef, useState, useEffect } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { ModelsTab } from "./ModelsTab";
import type { KnowledgeSourceKind } from "@/lib/types/builder";
import styles from "./PromptTab.module.css";

const KNOWLEDGE_ICON: Record<KnowledgeSourceKind, JSX.Element> = {
  file: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3v5h5" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
    </svg>
  ),
  url: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  ),
  text: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 5h14M5 12h14M5 19h9" />
    </svg>
  ),
};

const KNOWLEDGE_LABEL: Record<KnowledgeSourceKind, string> = {
  file: "Fichier",
  url: "Lien URL",
  text: "Note",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function PromptTab() {
  const {
    currentDraft,
    updateSystemPrompt,
    addKnowledgeSource,
    removeKnowledgeSource,
    toggleWebSearch,
    updateRoutine,
    updatePinnedArtefact,
  } = useBuilder();
  const wordCount = currentDraft.systemPrompt.trim().split(/\s+/).filter(Boolean).length;
  const [urlValue, setUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [routineRunning, setRoutineRunning] = useState(false);
  const [routineRunResult, setRoutineRunResult] = useState<string | null>(null);

  // Run forcé de la routine (test) : le serveur exécute la mission sur le gent
  // PUBLIÉ (état en base) et écrit le résultat dans son espace.
  async function handleRunRoutineNow() {
    setRoutineRunning(true);
    setRoutineRunResult(null);
    try {
      const res = await fetch("/api/routines/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gentId: currentDraft.id }),
      });
      const data = (await res.json()) as { results?: { status: string }[]; error?: string };
      if (!res.ok) {
        setRoutineRunResult(
          data.error === "supabase_not_configured"
            ? "Persistance serveur non configurée (variables Supabase absentes)."
            : `Erreur : ${data.error ?? res.status}`
        );
      } else {
        const status = data.results?.[0]?.status ?? "aucun gent trouvé en base (publiez d'abord)";
        setRoutineRunResult(`Run terminé : ${status}. Ouvrez l'espace utilisateur pour voir la note.`);
        if (status.startsWith("ok")) updateRoutine({ lastRunNote: status });
      }
    } catch (e) {
      setRoutineRunResult(`Erreur réseau : ${(e as Error).message}`);
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
    if (currentDraft.systemPrompt !== lastPushedRef.current) {
      setPromptValue(currentDraft.systemPrompt);
      lastPushedRef.current = currentDraft.systemPrompt;
    }
  }, [currentDraft.systemPrompt]);

  function handlePromptChange(text: string) {
    setPromptValue(text);
    lastPushedRef.current = text;
    updateSystemPrompt(text);
  }

  // « Prompt figé » de l'artefact « mini-app » : édité ici (onglet Prompt), plus
  // dans l'onglet Artefacts, pour ne pas le confondre avec le prompt système.
  // Même découplage local que le prompt système (accents pendant le streaming).
  const pinnedEnabled = !!currentDraft.pinnedArtefact?.enabled;
  const pinnedMission = currentDraft.pinnedArtefact?.mission ?? "";
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) addKnowledgeSource("file", file.name, `${formatSize(file.size)} · ajouté à l'instant`);
    e.target.value = "";
  }

  function handleAddUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    addKnowledgeSource("url", trimmed, "Ajouté à l'instant");
    setUrlValue("");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.webSearchRow}>
          <div>
            <h4 className={styles.title}>Prompt figé — artefact « mini-app »</h4>
            <div className={styles.sub}>
              Transforme le gent en mini-application : au lieu de converser, il produit un tableau de
              bord permanent que l&apos;utilisateur rafraîchit d&apos;un bouton. Le « prompt figé »
              ci-dessous décrit ce que le gent génère à chaque mise à jour — distinct du prompt
              système. La structure (titre, entrées) et l&apos;aperçu se règlent dans l&apos;onglet
              Artefacts.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pinnedEnabled}
            className={[styles.switch, pinnedEnabled ? styles.switchOn : ""].filter(Boolean).join(" ")}
            onClick={() => updatePinnedArtefact({ enabled: !pinnedEnabled })}
            aria-label="Activer le prompt figé (artefact mini-app)"
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
              aria-label="Prompt figé — mission de l'artefact"
            />
          </div>
        )}
      </div>

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

      <div className={styles.card}>
        <h4 className={styles.title}>Connaissances</h4>
        <div className={styles.sub}>
          Fichiers, données et liens que le gent peut consulter pour répondre — en complément du
          prompt système, sans limite de longueur.
        </div>

        {currentDraft.knowledgeSources.length > 0 && (
          <div className={styles.knowList}>
            {currentDraft.knowledgeSources.map((source) => (
              <div className={styles.knowRow} key={source.id}>
                <div className={styles.knowIc}>{KNOWLEDGE_ICON[source.kind]}</div>
                <div className={styles.knowInfo}>
                  <div className={styles.knowLabel}>{source.label}</div>
                  <div className={styles.knowMeta}>
                    {KNOWLEDGE_LABEL[source.kind]} · {source.meta}
                  </div>
                </div>
                <button
                  className={styles.knowRemove}
                  onClick={() => removeKnowledgeSource(source.id)}
                  aria-label={`Retirer ${source.label}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.knowAddRow}>
          <button type="button" className={styles.knowAddBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            Ajouter un fichier
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileChange} className={styles.hiddenFileInput} />

          <input
            className={styles.urlInput}
            type="url"
            placeholder="https://... (une page, une donnée de référence)"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            aria-label="Ajouter un lien URL comme connaissance"
          />
          <button type="button" className={styles.knowAddBtn} onClick={handleAddUrl}>
            + Ajouter le lien
          </button>
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
    </div>
  );
}
