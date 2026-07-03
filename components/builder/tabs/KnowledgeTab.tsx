"use client";

import { useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./KnowledgeTab.module.css";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function KnowledgeTab() {
  const { currentDraft, addKnowledgeFile, removeKnowledgeFile, addKnowledgeUrl, removeKnowledgeUrl } = useBuilder();
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => addKnowledgeFile(f.name, formatBytes(f.size)));
    e.target.value = "";
  }

  function handleAddUrl() {
    const url = urlInput.trim();
    if (!url) return;
    addKnowledgeUrl(url);
    setUrlInput("");
  }

  function handleUrlKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddUrl();
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h4 className={styles.title}>Fichiers</h4>
        <div className={styles.sub}>
          Documents que le gent doit connaître (guides, tarifs, procédures internes…).
        </div>

        {currentDraft.knowledgeFiles.length > 0 && (
          <div className={styles.list}>
            {currentDraft.knowledgeFiles.map((f) => (
              <div className={styles.row} key={f.id}>
                <span className={styles.rowIcon}>📄</span>
                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>{f.name}</span>
                  <span className={styles.rowMeta}>{f.size}</span>
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeKnowledgeFile(f.id)}
                  aria-label={`Retirer ${f.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={handleFilesSelected}
          aria-label="Ajouter des fichiers à la base de connaissance"
        />
        <button type="button" className={styles.addBtn} onClick={() => fileInputRef.current?.click()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12M7 8l5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
          Ajouter un fichier
        </button>
      </div>

      <div className={styles.card}>
        <h4 className={styles.title}>URLs de référence</h4>
        <div className={styles.sub}>
          Pages web que le gent doit connaître (documentation, site partenaire…).
        </div>

        {currentDraft.knowledgeUrls.length > 0 && (
          <div className={styles.list}>
            {currentDraft.knowledgeUrls.map((u) => (
              <div className={styles.row} key={u.id}>
                <span className={styles.rowIcon}>🔗</span>
                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>{u.url}</span>
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeKnowledgeUrl(u.id)}
                  aria-label={`Retirer ${u.url}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.urlForm}>
          <input
            type="url"
            className={styles.urlInput}
            placeholder="https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            aria-label="Ajouter une URL à la base de connaissance"
          />
          <button type="button" className={styles.addBtn} onClick={handleAddUrl} disabled={!urlInput.trim()}>
            Ajouter
          </button>
        </div>
      </div>

      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          Dans cette maquette, seuls les noms de fichiers et les URLs sont transmis au gent en
          contexte — leur contenu n&apos;est pas encore analysé automatiquement (pas de pipeline
          d&apos;indexation).
        </span>
      </div>
    </div>
  );
}
