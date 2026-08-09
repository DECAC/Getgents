"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  allocateNewDraft,
  listVisibleDrafts,
  restoreDraftFromPublished,
  saveRestoredDraft,
  syncDraftsFromRemote,
} from "@/lib/builderDraftStorage";
import { readPublishedGents, syncPublishedGentsFromRemote } from "@/lib/publishedGents";
import { readAppSecret } from "@/lib/appAccess";
import { deleteGentEverywhere } from "@/lib/deleteGent";
import { AppAccessPrompt } from "@/components/shared/AppAccessPrompt";
import type { GentDraft } from "@/lib/types/builder";
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

function computeOrphans(visible: GentDraft[]): { id: string; espace: Espace }[] {
  const draftIds = new Set(visible.map((d) => d.id));
  const published = readPublishedGents();
  return Object.entries(published)
    .filter(([id]) => !draftIds.has(id))
    .map(([id, espace]) => ({ id, espace }));
}

export function BuilderDashboard() {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => listVisibleDrafts());
  const [orphanedPublished, setOrphanedPublished] = useState<{ id: string; espace: Espace }[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [needsAccessKey, setNeedsAccessKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refreshLists = useCallback(() => {
    const visible = listVisibleDrafts();
    setDrafts(visible);
    setOrphanedPublished(computeOrphans(visible));
  }, []);

  const hydrateFromRemote = useCallback(async () => {
    setSyncing(true);
    setNeedsAccessKey(false);
    try {
      // Sans clé, les routes /api/drafts et /api/gents répondent 401 : on
      // propose tout de suite la saisie plutôt que d'afficher seulement les démos.
      if (!readAppSecret()) {
        setNeedsAccessKey(true);
      }
      const [remoteDrafts, remotePublished] = await Promise.all([
        syncDraftsFromRemote(),
        syncPublishedGentsFromRemote(),
      ]);
      // Si aucune sync n'a abouti alors qu'une clé est (censée être) présente,
      // elle est peut‑être invalide — on réaffiche le champ.
      if (remoteDrafts === null && remotePublished === null && readAppSecret()) {
        setNeedsAccessKey(true);
      }
      if (remoteDrafts !== null || remotePublished !== null) {
        setNeedsAccessKey(false);
      }
      refreshLists();
    } finally {
      setSyncing(false);
    }
  }, [refreshLists]);

  useEffect(() => {
    refreshLists();
    void hydrateFromRemote();
  }, [refreshLists, hydrateFromRemote]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredDrafts = normalizedQuery
    ? drafts.filter((d) => d.name.toLowerCase().includes(normalizedQuery))
    : drafts;
  const filteredOrphans = normalizedQuery
    ? orphanedPublished.filter(({ espace }) => (espace.gent || espace.name || "").toLowerCase().includes(normalizedQuery))
    : orphanedPublished;
  const noResults =
    normalizedQuery.length > 0 && filteredDrafts.length === 0 && filteredOrphans.length === 0;

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

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Supprimer définitivement « ${name} » ? Cette action est irréversible : le brouillon, le gent publié et ses liens de partage seront effacés.`)) {
      return;
    }
    setDeleteError(null);
    setDeletingId(id);
    try {
      const result = await deleteGentEverywhere(id);
      if (!result.ok) {
        setDeleteError(`Suppression incomplète pour « ${name} » : ${result.error ?? "erreur inconnue"}`);
      }
      refreshLists();
    } finally {
      setDeletingId(null);
    }
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

        <div className={styles.searchRow}>
          <svg
            className={styles.searchIcon}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Rechercher un gent par nom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Rechercher un gent par nom"
          />
          {query && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        {needsAccessKey && (
          <div className={styles.recoveryBanner}>
            <strong>Accès serveur requis</strong> — sans la clé, seuls les gents de démo locaux
            s&apos;affichent. Collez APP_ACCESS_SECRET pour retrouver vos gents (ex. Next Move) depuis
            le serveur.
            <div style={{ marginTop: 10 }}>
              <AppAccessPrompt onSaved={() => void hydrateFromRemote()} />
            </div>
          </div>
        )}

        {syncing && !needsAccessKey && (
          <div className={styles.recoveryBanner}>Synchronisation de vos gents…</div>
        )}

        {orphanedPublished.length > 0 && (
          <div className={styles.recoveryBanner}>
            <strong>Gents publiés retrouvés</strong> — le brouillon builder a pu disparaître après une mise à
            jour, mais l&apos;espace publié est toujours disponible. Vous pouvez le rouvrir ou
            restaurer le brouillon.
          </div>
        )}

        {deleteError && <div className={styles.deleteError}>{deleteError}</div>}

        {noResults && (
          <div className={styles.noResults}>Aucun gent ne correspond à « {query.trim()} ».</div>
        )}

        <div className={styles.grid}>
          {filteredDrafts.map((d) => (
            <div key={d.id} className={styles.card}>
              <a href={`/builder/${d.id}`} className={styles.cardLink}>
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
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(d.id, d.name || "ce gent")}
                  disabled={deletingId === d.id}
                >
                  {deletingId === d.id ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}

          {filteredOrphans.map(({ id, espace }) => (
            <div key={id} className={[styles.card, styles.recoveryCard].join(" ")}>
              <div className={styles.cardTop}>
                <div className={styles.ic}>{espace.icon}</div>
                <div>
                  <div className={styles.name}>{espace.gent || espace.name}</div>
                  <span className={[styles.statusBadge, styles.statusPublished].join(" ")}>Publié (espace seul)</span>
                </div>
              </div>
              <p className={styles.objective}>
                Brouillon builder absent — l&apos;espace utilisateur est conservé. Restaurez-le pour
                continuer à l&apos;éditer (prompt, mini-app, connecteurs…).
              </p>
              <div className={styles.recoveryActions}>
                <a href={`/espace/${id}`} className={styles.recoveryLink}>
                  Ouvrir l&apos;espace
                </a>
                <button type="button" className={styles.recoveryBtn} onClick={() => handleRestore(id, espace)}>
                  Restaurer dans le builder
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(id, espace.gent || espace.name)}
                  disabled={deletingId === id}
                >
                  {deletingId === id ? "Suppression…" : "Supprimer"}
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
