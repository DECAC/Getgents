"use client";

import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import styles from "./BuilderHeader.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  review: "En revue",
  published: "Publié",
};

const STATUS_CLASS: Record<string, string> = {
  draft: styles.statusDraft,
  review: styles.statusReview,
  published: styles.statusPublished,
};

const TABS: { id: BuilderTab; label: string; icon: JSX.Element }[] = [
  {
    id: "prompt",
    label: "Prompt",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6M12 4v16" />
      </svg>
    ),
  },
  {
    id: "models",
    label: "Modèles",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "connectors",
    label: "Connecteurs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
      </svg>
    ),
  },
  {
    id: "artefacts",
    label: "Artefacts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 3v5h5" />
        <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
      </svg>
    ),
  },
];

export function BuilderHeader() {
  const { currentDraft, activeTab, switchTab, updateName, updateObjective, publishDraft } = useBuilder();

  return (
    <header className={styles.head}>
      <div className={styles.top}>
        <div className={styles.ic}>{currentDraft.icon}</div>
        <div className={styles.meta}>
          <input
            className={styles.nameInput}
            value={currentDraft.name}
            onChange={(e) => updateName(e.target.value)}
            placeholder="Nom du gent"
            aria-label="Nom du gent"
          />
          <input
            className={styles.objectiveInput}
            value={currentDraft.objective}
            onChange={(e) => updateObjective(e.target.value)}
            placeholder="Objectif premier de ce gent, en une phrase…"
            aria-label="Objectif du gent"
          />
        </div>
        <span className={[styles.statusPill, STATUS_CLASS[currentDraft.status]].join(" ")}>
          {STATUS_LABEL[currentDraft.status]}
        </span>
        <button
          className={styles.publishBtn}
          onClick={publishDraft}
          disabled={currentDraft.status === "published" || !currentDraft.systemPrompt.trim()}
        >
          {currentDraft.status === "published" ? "Publié" : "Publier la V1"}
        </button>
      </div>

      <div className={styles.threadbar} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={[styles.tab, activeTab === tab.id ? styles.tabOn : ""].filter(Boolean).join(" ")}
            onClick={() => switchTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
