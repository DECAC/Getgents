"use client";

import { useRouter } from "next/navigation";
import { GENT_DRAFTS } from "@/lib/mock-data/builder";
import { allocateNewDraft } from "@/lib/builderDraftStorage";
import styles from "./BuilderDashboard.module.css";

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

export function BuilderDashboard() {
  const router = useRouter();
  const drafts = Object.values(GENT_DRAFTS).filter((d) => d.id !== "nouveau-gent");

  function handleCreate() {
    const id = allocateNewDraft();
    router.push(`/builder/${id}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div className={styles.mark} aria-hidden="true" />
          <div>
            <h1 className={styles.title}>Gent&apos; studio</h1>
            <div className={styles.sub}>Concevez, testez et publiez la V1 de vos gents.</div>
          </div>
          <a href="/espace/voyage" className={styles.backLink}>
            ← Retour à l&apos;espace utilisateur
          </a>
        </div>

        <div className={styles.grid}>
          {drafts.map((d) => (
            <a key={d.id} href={`/builder/${d.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.ic}>{d.icon}</div>
                <div>
                  <div className={styles.name}>{d.name}</div>
                  <span className={[styles.statusBadge, STATUS_CLASS[d.status]].join(" ")}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>
              </div>
              <p className={styles.objective}>{d.objective || "Aucun objectif défini pour l'instant."}</p>
              <div className={styles.meta}>Mis à jour {d.updatedAt}</div>
            </a>
          ))}

          <button className={[styles.card, styles.newCard].join(" ")} onClick={handleCreate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouveau gent
          </button>
        </div>
      </div>
    </div>
  );
}
