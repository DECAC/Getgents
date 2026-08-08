"use client";

import { useRef, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { extractDocumentText } from "@/lib/extractDocumentText";
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

/**
 * Connaissances du gent — sous « Contexte » et non sous le gent
 * conversationnel : ces sources alimentent aussi bien la conversation que la
 * génération de la mini-app, elles sont transverses aux deux modes.
 */
export function KnowledgeTab() {
  const { currentDraft, addKnowledgeSource, removeKnowledgeSource } = useBuilder();
  const [urlValue, setUrlValue] = useState("");
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Le texte est extrait ici, côté navigateur, et attaché à la source : sans
  // lui le gent ne connaît que le NOM du fichier (c'était le comportement
  // d'origine — une simple référence listée dans le prompt, jamais lue).
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileBusy(`Lecture de ${file.name}…`);
    try {
      const doc = await extractDocumentText(file);
      addKnowledgeSource(
        "file",
        file.name,
        `${formatSize(file.size)} · ajouté à l'instant${doc.truncated ? " · tronqué" : ""}`,
        doc.text,
        doc.truncated
      );
      setFileBusy(null);
    } catch (err) {
      // Extraction impossible (format non pris en charge, PDF scanné…) : la
      // source est quand même déclarée, en repli sur le nom seul, pour ne pas
      // perdre la déclaration du créateur — mais le gent n'en verra que le nom.
      addKnowledgeSource("file", file.name, `${formatSize(file.size)} · contenu non lu`);
      setFileBusy(`⚠ ${(err as Error).message}`);
    }
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
        <h4 className={styles.title}>Connaissances</h4>
        <div className={styles.sub}>
          Fichiers, données et liens que le gent peut consulter pour répondre — en complément des
          instructions système, sans limite de longueur. Ces sources servent aussi bien à la
          conversation qu&apos;à la génération de la mini-app.
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
                    {source.kind === "file" && (
                      <>
                        {" · "}
                        {source.text ? "contenu lu par le gent" : "nom seul (contenu non accessible au gent)"}
                      </>
                    )}
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

        {fileBusy && <div className={styles.knowBusy}>{fileBusy}</div>}

        <div className={styles.knowAddRow}>
          <button type="button" className={styles.knowAddBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            Ajouter un fichier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.csv,.tsv"
            onChange={handleFileChange}
            className={styles.hiddenFileInput}
          />

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
    </div>
  );
}
