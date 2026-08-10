"use client";

import { useGentsList } from "@/lib/hooks/useGentsList";
import { AppAccessPrompt } from "@/components/shared/AppAccessPrompt";
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
  const {
    query,
    setQuery,
    filteredDrafts,
    filteredOrphans,
    noResults,
    orphanedPublished,
    syncing,
    needsAccessKey,
    deletingId,
    deleteError,
    hydrateFromRemote,
    handleCreate,
    handleRestore,
    handleDelete,
  } = useGentsList();

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
