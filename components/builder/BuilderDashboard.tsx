"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allocateNewDraft,
  listVisibleDrafts,
  restoreDraftFromPublished,
  saveRestoredDraft,
} from "@/lib/builderDraftStorage";
import { readPublishedGents } from "@/lib/publishedGents";
import type { Espace } from "@/lib/types";
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
  const [drafts, setDrafts] = useState(() => listVisibleDrafts());
  const [orphanedPublished, setOrphanedPublished] = useState<{ id: string; espace: Espace }[]>([]);

  useEffect(() => {
    const visible = listVisibleDrafts();
    setDrafts(visible);
    const draftIds = new Set(visible.map((d) => d.id));
    const published = readPublishedGents();
    setOrphanedPublished(
      Object.entries(published)
        .filter(([id]) => !draftIds.has(id))
        .map(([id, espace]) => ({ id, espace }))
    );
  }, []);

  function handleCreate() {
    const id = allocateNewDraft();
    router.push(`/builder/${id}`);
  }

  function handleRestore(id: string, espace: Espace) {
    const draft = restoreDraftFromPublished(id, espace);
    saveRestoredDraft(draft);
    setDrafts(listVisibleDrafts());
    setOrphanedPublished((prev) => prev.filter((p) => p.id !== id));
    router.push(`/builder/${id}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <div className={styles.mark} aria-hidden="true" />
          <div>
            <h1 className={styles.title}>Gent&apos;studio</h1>
            <div className={styles.sub}>Concevez, testez et publiez la V1 de vos gents.</div>
          </div>
          <a href="/espace/voyage" className={styles.backLink}>
            ← Retour à l&apos;espace utilisateur
          </a>
        </div>

        {orphanedPublished.length > 0 && (
          <div className={styles.recoveryBanner}>
            <strong>Gents publiés retrouvés</strong> — le brouillon builder a pu disparaître après une mise à
            jour, mais l&apos;espace publié est toujours dans votre navigateur. Vous pouvez le rouvrir ou
            restaurer le brouillon.
          </div>
        )}

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

          {orphanedPublished.map(({ id, espace }) => (
            <div key={id} className={[styles.card, styles.recoveryCard].join(" ")}>
              <div className={styles.cardTop}>
                <div className={styles.ic}>{espace.icon}</div>
                <div>
                  <div className={styles.name}>{espace.name}</div>
                  <span className={[styles.statusBadge, styles.statusPublished].join(" ")}>Publié (espace seul)</span>
                </div>
              </div>
              <p className={styles.objective}>
                Brouillon builder absent — l&apos;espace utilisateur est conservé dans ce navigateur.
              </p>
              <div className={styles.recoveryActions}>
                <a href={`/espace/${id}`} className={styles.recoveryLink}>
                  Ouvrir l&apos;espace
                </a>
                <button type="button" className={styles.recoveryBtn} onClick={() => handleRestore(id, espace)}>
                  Restaurer dans le builder
                </button>
              </div>
            </div>
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
