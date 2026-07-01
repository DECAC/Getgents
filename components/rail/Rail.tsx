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

      <a href="/decouvrir" className={styles.discover} title="Découvrir des gents">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className={styles.discoverLabel}>Découvrir des gents</span>
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
