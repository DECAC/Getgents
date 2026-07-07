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

export function CenterHeader() {
  const { currentEspace } = useEspace();
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
    </header>
  );
}
