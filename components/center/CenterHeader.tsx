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

      {e.metrics.length > 0 && (
        <div className={styles.metrics} aria-label="Indicateurs du gent">
          {e.metrics.map((metric, i) => (
            <div
              key={i}
              className={[styles.metric, metric.warn ? styles.metricWarn : ""].filter(Boolean).join(" ")}
            >
              <div className={styles.metricVal}>
                {metric.value}
                {metric.suffix && <span className={styles.metricOf}> {metric.suffix}</span>}
              </div>
              <div className={styles.metricLabel}>{metric.label}</div>
            </div>
          ))}
        </div>
      )}

      {(e.tabs.length > 0 || e.map) && (
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
        </div>
      )}
    </header>
  );
}
