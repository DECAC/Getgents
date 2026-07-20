"use client";

import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { hasCustomName, isDirtySincePublish } from "@/lib/builderSnapshot";
import styles from "./BuilderHeader.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  review: "En revue",
  published: "Publié",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  draft: styles.dotDraft,
  review: styles.dotReview,
  published: styles.dotPublished,
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
  {
    id: "diffusion",
    label: "Diffusion",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Audit",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
      </svg>
    ),
  },
];

export function BuilderHeader() {
  const { currentDraft, activeTab, switchTab, updateName, updateObjective, publishDraft } = useBuilder();

  const nameOk = hasCustomName(currentDraft);
  const dirty = isDirtySincePublish(currentDraft);
  const alreadyLive = currentDraft.status === "published" && !dirty;
  const publishDisabled = alreadyLive || !nameOk || !currentDraft.systemPrompt.trim();

  let publishLabel = "Publier la V1";
  if (alreadyLive) publishLabel = "Publié";
  else if (currentDraft.status === "published" && dirty) publishLabel = "Publier la mise à jour";

  let publishHint: string | undefined;
  if (!nameOk) publishHint = "Donnez un nom au gent avant de publier";
  else if (!currentDraft.systemPrompt.trim()) publishHint = "Rédigez un prompt système avant de publier";

  return (
    <header className={styles.head}>
      <div className={styles.top}>
        <div className={styles.ic}>{currentDraft.icon}</div>
        <div className={styles.meta}>
          <label className={styles.nameLabel} htmlFor="gent-name">
            Nom du gent
          </label>
          <div className={styles.nameWrap}>
            <input
              id="gent-name"
              className={styles.nameInput}
              value={currentDraft.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Ex. Assistant au pair, Coach voyage…"
              aria-label="Nom du gent"
              spellCheck={false}
            />
            <span className={styles.statusInline}>
              <span className={[styles.statusDot, STATUS_DOT_CLASS[currentDraft.status]].join(" ")} />
              {STATUS_LABEL[currentDraft.status]}
            </span>
            <span className={styles.nameEditHint} aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
          </div>
          {!nameOk && <div className={styles.nameWarning}>Donnez un nom à ce gent pour pouvoir le publier</div>}
          <input
            className={styles.objectiveInput}
            value={currentDraft.objective}
            onChange={(e) => updateObjective(e.target.value)}
            placeholder="Objectif premier de ce gent, en une phrase…"
            aria-label="Objectif du gent"
          />
        </div>
        <button
          className={styles.publishBtn}
          onClick={publishDraft}
          disabled={publishDisabled}
          title={publishHint}
        >
          {publishLabel}
        </button>
        {currentDraft.status === "published" && (
          <a
            href={`/espace/${currentDraft.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewLiveLink}
          >
            Preview
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6M10 14 21 3" />
            </svg>
          </a>
        )}
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
