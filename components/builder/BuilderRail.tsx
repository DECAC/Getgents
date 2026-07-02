"use client";

import { useRouter } from "next/navigation";
import { useBuilder } from "@/lib/context/BuilderContext";
import styles from "./BuilderRail.module.css";

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

export function BuilderRail() {
  const { drafts, currentId, switchDraft, createDraft, railCollapsed, toggleRail } = useBuilder();
  const router = useRouter();

  function handleSwitch(id: string) {
    switchDraft(id);
    router.push(`/builder/${id}`);
  }

  function handleCreate() {
    const id = createDraft();
    router.push(`/builder/${id}`);
  }

  const items = Object.values(drafts).filter((d) => d.id !== "nouveau-gent");

  return (
    <nav
      className={[styles.rail, railCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}
      aria-label="Gents en construction"
      id="builder-rail"
    >
      <div className={styles.brand}>
        <div className={styles.mark} aria-hidden="true" />
        <h1 className={styles.brandName}>Gent&apos; studio</h1>
        <a href="/espace/voyage" className={styles.backLink} title="Retour à l'espace utilisateur">
          ← Espace
        </a>
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

      <div className={styles.label}>Mes gents</div>

      <button className={styles.newBtn} onClick={handleCreate} title="Nouveau gent">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className={styles.newBtnLabel}>Nouveau gent</span>
      </button>

      <ul className={styles.list} role="list">
        {items.map((d) => (
          <li key={d.id}>
            <button
              className={[styles.item, d.id === currentId ? styles.active : ""].filter(Boolean).join(" ")}
              onClick={() => handleSwitch(d.id)}
              title={d.name}
            >
              <span className={styles.ic}>{d.icon}</span>
              <span className={styles.body}>
                <div className={styles.name}>{d.name || "Sans nom"}</div>
                <div className={styles.meta}>
                  <span className={[styles.statusBadge, STATUS_CLASS[d.status]].join(" ")}>
                    {STATUS_LABEL[d.status]}
                  </span>
                  {d.updatedAt}
                </div>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
