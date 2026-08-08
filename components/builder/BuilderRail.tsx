"use client";

import { useEffect, useRef, useState } from "react";
import { useBuilder, type BuilderTab } from "@/lib/context/BuilderContext";
import { hasCustomName, isDirtySincePublish } from "@/lib/builderSnapshot";
import styles from "./BuilderRail.module.css";

interface NavEntry {
  id: BuilderTab;
  label: string;
  icon: JSX.Element;
}

interface NavSection {
  /** Absent pour une entrée de premier niveau (Accueil, Diffusion). */
  title?: string;
  entries: NavEntry[];
}

const ICON = {
  accueil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  ),
  conversationnel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  ),
  miniapp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 8h8M8 12h5M8 16h8" />
    </svg>
  ),
  connectors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </svg>
  ),
  knowledge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
    </svg>
  ),
  diffusion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  ),
};

// La navigation suit le parcours de construction : on choisit ce qu'on
// fabrique (Créer), on lui donne de quoi travailler (Contexte), on vérifie
// (Monitor), puis on l'ouvre au monde (Diffusion). Connaissances vit dans
// Contexte et non dans le gent conversationnel : la mini-app s'en sert aussi.
const NAV: NavSection[] = [
  { entries: [{ id: "accueil", label: "Accueil", icon: ICON.accueil }] },
  {
    title: "Créer",
    entries: [
      { id: "conversationnel", label: "Gent Conversationnel", icon: ICON.conversationnel },
      { id: "miniapp", label: "Mini App", icon: ICON.miniapp },
    ],
  },
  {
    title: "Contexte",
    entries: [
      { id: "connectors", label: "Connecteurs", icon: ICON.connectors },
      { id: "knowledge", label: "Connaissances", icon: ICON.knowledge },
    ],
  },
  { title: "Monitor", entries: [{ id: "audit", label: "Audit", icon: ICON.audit }] },
  { entries: [{ id: "diffusion", label: "Diffusion", icon: ICON.diffusion }] },
];

export function BuilderRail() {
  const { currentDraft, activeTab, switchTab, railCollapsed, toggleRail, publishDraft } = useBuilder();
  const [menuOpen, setMenuOpen] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);

  // Fermeture du menu de marque au clic extérieur / Échap.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!brandRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const nameOk = hasCustomName(currentDraft);
  const dirty = isDirtySincePublish(currentDraft);
  const live = currentDraft.status === "published";
  const publishDisabled = (live && !dirty) || !nameOk || !currentDraft.systemPrompt.trim();

  let publishLabel = "Diffuser le gent";
  if (live && !dirty) publishLabel = "Diffusé — à jour";
  else if (live && dirty) publishLabel = "Diffuser les modifications";

  let publishHint: string | undefined;
  if (!nameOk) publishHint = "Donnez un nom au gent avant de le diffuser";
  else if (!currentDraft.systemPrompt.trim()) publishHint = "Rédigez des instructions système avant de diffuser";
  else if (live && dirty) publishHint = "Des modifications ne sont pas encore diffusées aux utilisateurs";
  else if (live) publishHint = "La version diffusée correspond à votre version de travail";
  else publishHint = "Rend le gent accessible sur les canaux de l'onglet Diffusion";

  return (
    <nav
      className={[styles.rail, railCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}
      aria-label="Configuration du gent"
      id="builder-rail"
    >
      <div className={styles.brand} ref={brandRef}>
        <button
          type="button"
          className={styles.brandBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Gent' studio"
        >
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.brandName}>Gent&apos; studio</span>
          <svg
            className={styles.brandChevron}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          className={styles.railToggle}
          onClick={toggleRail}
          aria-label={railCollapsed ? "Déployer la colonne" : "Réduire la colonne"}
          title={railCollapsed ? "Déployer" : "Réduire"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: railCollapsed ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>

        {menuOpen && (
          <div className={styles.brandMenu} role="menu">
            <a href="/builder" className={styles.brandMenuItem} role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
              </svg>
              <span>
                <span className={styles.brandMenuLabel}>Gent&apos; space</span>
                <span className={styles.brandMenuSub}>Tous vos gents</span>
              </span>
            </a>
          </div>
        )}
      </div>

      <button
        type="button"
        className={[styles.publishBtn, live && !dirty ? styles.publishBtnLive : ""].filter(Boolean).join(" ")}
        onClick={publishDraft}
        disabled={publishDisabled}
        title={publishHint}
      >
        <svg
          className={styles.publishIcon}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        <span className={styles.publishLabel}>{publishLabel}</span>
      </button>

      <div className={styles.nav}>
        {NAV.map((section, si) => (
          <div className={styles.section} key={section.title ?? `top-${si}`}>
            {section.title && <div className={styles.sectionTitle}>{section.title}</div>}
            {section.entries.map((entry) => (
              <button
                key={entry.id}
                className={[styles.navItem, activeTab === entry.id ? styles.navItemOn : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => switchTab(entry.id)}
                title={entry.label}
                aria-current={activeTab === entry.id ? "page" : undefined}
              >
                <span className={styles.navIcon}>{entry.icon}</span>
                <span className={styles.navLabel}>{entry.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
