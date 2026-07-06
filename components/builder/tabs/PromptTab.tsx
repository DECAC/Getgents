"use client";

import { useRef, useState } from "react";
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
  const { currentDraft, updateSystemPrompt, addKnowledgeSource, removeKnowledgeSource, toggleWebSearch } = useBuilder();
  const wordCount = currentDraft.systemPrompt.trim().split(/\s+/).filter(Boolean).length;
  const [urlValue, setUrlValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <h4 className={styles.title}>Instructions système (prompt)</h4>
        <div className={styles.sub}>
          Ce texte définit le comportement du gent en production. Décrivez son rôle, ses règles
          impératives (ex. invariants de sécurité) et le ton attendu — l&apos;assistant du builder
          peut vous aider à le rédiger.
        </div>
        <textarea
          className={styles.promptArea}
          value={currentDraft.systemPrompt}
          onChange={(e) => updateSystemPrompt(e.target.value)}
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
