"use client";

import { useRouter } from "next/navigation";
import { useEspace } from "@/lib/context/EspaceContext";
import styles from "./Rail.module.css";

const STATUS_DOT_CLASS: Record<string, string> = {
  live: styles.dotLive,
  paused: styles.dotPaused,
  done: styles.dotDone,
};

export function Rail() {
  const { espaces, currentId, railCollapsed, toggleRail, switchEspace } = useEspace();
  const router = useRouter();

  function handleSwitch(id: string) {
    switchEspace(id);
    router.push(`/espace/${id}`);
  }

  return (
    <nav
      className={[styles.rail, railCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}
      aria-label="Mes gents actifs"
      id="rail"
    >
      <div className={styles.brand}>
        <div className={styles.mark} aria-hidden="true" />
        <h1 className={styles.brandName}>Getgents</h1>
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
      </div>

      <div className={styles.railLabel}>Mes gents actifs</div>

      <ul className={styles.espaceList} role="list">
        {Object.entries(espaces).map(([id, e]) => (
          <li key={id}>
            <button
              className={[styles.espaceItem, id === currentId ? styles.active : ""].filter(Boolean).join(" ")}
              onClick={() => handleSwitch(id)}
              title={e.name}
              aria-current={id === currentId ? "page" : undefined}
            >
              <span className={[styles.ic, id === currentId ? styles.icActive : ""].filter(Boolean).join(" ")}>
                {e.icon}
              </span>
              <span className={styles.body}>
                <span className={styles.name}>{e.name}</span>
                <span className={styles.sub}>
                  <span className={[styles.dot, STATUS_DOT_CLASS[e.status]].filter(Boolean).join(" ")} />
                  {e.statusLabel} · {e.gent}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <a href="/builder" className={styles.discover} title="Gent' studio — construire un gent">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
        </svg>
        <span className={styles.discoverLabel}>Construire un gent</span>
      </a>

      <div className={styles.acct} title="Camille Léaud">
        <div className={styles.av}>CL</div>
        <div className={styles.acctMeta}>
          <div className={styles.who}>Camille Léaud</div>
          <div className={styles.plan}>Forfait Gents · 3 actifs</div>
        </div>
      </div>
    </nav>
  );
}
