"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import styles from "./CenterHeader.module.css";

const STATUS_CLASS: Record<string, string> = {
  live: styles.pillLive,
  paused: styles.pillPaused,
  done: styles.pillDone,
};

const DOT_CLASS: Record<string, string> = {
  live: styles.dotLive,
  paused: styles.dotPaused,
  done: styles.dotDone,
};

const TAB_ICONS = {
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M12 7v3M12 14v3" />
    </svg>
  ),
  resv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l2 2 4-4" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  ),
};

export function CenterHeader() {
  const { currentEspace, activeTab, switchTab } = useEspace();
  const e = currentEspace;

  return (
    <header className={styles.ehead}>
      <div className={styles.eheadTop}>
        <div className={styles.ic}>{e.icon}</div>
        <div className={styles.meta}>
          <h2 className={styles.title}>{e.name}</h2>
          <div className={styles.gentline}>
            Propulsé par <b>{e.gent}</b> · version {e.version}
          </div>
        </div>
        <span className={[styles.statusPill, STATUS_CLASS[e.status]].filter(Boolean).join(" ")}>
          <span className={[styles.dot, DOT_CLASS[e.status]].filter(Boolean).join(" ")} />
          {e.statusLabel}
        </span>
      </div>

      <div className={styles.badges}>
        <span className={styles.badgeAi}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          Interaction IA
        </span>

        {e.sensitive && (
          <span className={styles.badgeSens}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Données sensibles
          </span>
        )}

        {e.integrations.map((intg, i) => (
          <button
            key={i}
            className={[styles.badge, intg.action ? styles.badgeAct : styles.badgeInt].join(" ")}
            onClick={() => switchTab("tools")}
            title={intg.action ? "Action engageante — voir dans Tools" : "Lecture seule — voir dans Tools"}
          >
            {intg.action ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
              </svg>
            )}
            {intg.label}
          </button>
        ))}
      </div>

      {(e.tabs.length > 0 || e.map || e.tools.length > 0) && (
        <div className={styles.threadbar} role="tablist">
          {e.tabs.map((tab, i) => (
            <button
              key={tab.id}
              className={[styles.tab, activeTab === i ? styles.tabOn : ""].filter(Boolean).join(" ")}
              onClick={() => switchTab(i)}
              role="tab"
              aria-selected={activeTab === i}
            >
              <span className={styles.tabIcon}>{TAB_ICONS[tab.kind]}</span>
              {tab.name}
            </button>
          ))}

          {e.map && (
            <button
              className={[styles.tab, activeTab === "map" ? styles.tabOn : ""].filter(Boolean).join(" ")}
              onClick={() => switchTab("map")}
              role="tab"
              aria-selected={activeTab === "map"}
            >
              <span className={styles.tabIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
                  <path d="M9 4v14M15 6v14" />
                </svg>
              </span>
              Carte
            </button>
          )}

          {e.tools.length > 0 && (
            <button
              className={[styles.tab, activeTab === "tools" ? styles.tabOn : ""].filter(Boolean).join(" ")}
              onClick={() => switchTab("tools")}
              role="tab"
              aria-selected={activeTab === "tools"}
            >
              <span className={styles.tabIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
                </svg>
              </span>
              Tools
            </button>
          )}
        </div>
      )}
    </header>
  );
}
