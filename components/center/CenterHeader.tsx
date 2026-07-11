"use client";

import { useEffect, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { readPublishedGents } from "@/lib/publishedGents";
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
  const { currentEspace, currentId } = useEspace();
  const e = currentEspace;
  // Bascule vers le gent studio : uniquement pour les gents publiés depuis ce
  // navigateur (le brouillon correspondant existe côté builder).
  const [isPublishedGent, setIsPublishedGent] = useState(false);
  useEffect(() => {
    setIsPublishedGent(!!readPublishedGents()[currentId]);
  }, [currentId]);

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
        {isPublishedGent && (
          <a className={styles.builderLink} href={`/builder/${currentId}`} title="Modifier ce gent dans le gent studio">
            🛠️ Ouvrir dans le gent studio
          </a>
        )}
        <span className={[styles.statusPill, STATUS_CLASS[e.status]].filter(Boolean).join(" ")}>
          <span className={[styles.dot, DOT_CLASS[e.status]].filter(Boolean).join(" ")} />
          {e.statusLabel}
        </span>
      </div>
    </header>
  );
}
