"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { allocateNewDraft } from "@/lib/builderDraftStorage";
import { useGentsList } from "@/lib/hooks/useGentsList";
import { SessionExpiree } from "@/components/shared/SessionExpiree";
import styles from "./MesGentsTab.module.css";

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

type View = "tuile" | "liste";

function SelectionCheck({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className={styles.check} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} aria-label={label} />
    </label>
  );
}

/**
 * Liste des gents au niveau studio (/builder/mesgents) : tuiles ou lignes,
 * sans bandeau ni assistant d'un gent ouvert. Accessible via « Mes gents »
 * dans le rail ; la bascule vers Gent' space se fait uniquement par le menu
 * titre en haut à gauche.
 */
export function MesGentsTab() {
  const router = useRouter();
  const {
    query,
    setQuery,
    filteredDrafts,
    filteredOrphans,
    noResults,
    orphanedPublished,
    syncing,
    sessionExpiree,
    deletingId,
    deletingCount,
    deleteError,
    hydrateFromRemote,
    refreshLists,
    handleRestore,
    handleDelete,
    handleDeleteMany,
  } = useGentsList();

  function handleCreateNew() {
    const id = allocateNewDraft();
    refreshLists();
    router.push(`/builder/${id}`);
  }
  const [view, setView] = useState<View>("tuile");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const busy = deletingCount !== null;

  const visibleItems = useMemo(
    () => [
      ...filteredDrafts.map((d) => ({ id: d.id, name: d.name || "ce gent" })),
      ...filteredOrphans.map(({ id, espace }) => ({ id, name: espace.gent || espace.name || "ce gent" })),
    ],
    [filteredDrafts, filteredOrphans]
  );
  const visibleIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;

  function toggleId(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const items = visibleItems.filter((i) => selected.has(i.id));
    const outcome = await handleDeleteMany(items);
    if (outcome !== "cancelled") setSelected(new Set());
  }

  return (
    <div className={styles.wrap}>
      <div>
        <h4 className={styles.title}>Mes gents</h4>
        <div className={styles.sub}>Tous les gents de votre Gent&apos;space — créez-en un ou reprenez-en un.</div>
      </div>

      <div className={styles.headRow}>
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

        <div className={styles.viewToggle} role="tablist" aria-label="Affichage">
          <button
            type="button"
            role="tab"
            aria-selected={view === "tuile"}
            className={[styles.viewBtn, view === "tuile" ? styles.viewBtnOn : ""].filter(Boolean).join(" ")}
            onClick={() => setView("tuile")}
            title="Vue en tuiles"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
            </svg>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "liste"}
            className={[styles.viewBtn, view === "liste" ? styles.viewBtnOn : ""].filter(Boolean).join(" ")}
            onClick={() => setView("liste")}
            title="Vue en liste"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <button type="button" className={styles.newBtn} onClick={handleCreateNew}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau gent
        </button>
      </div>

      {visibleIds.length > 0 && (
        <div className={styles.bulkBar}>
          <SelectionCheck
            checked={allVisibleSelected}
            disabled={busy}
            label={allVisibleSelected ? "Tout désélectionner" : "Tout sélectionner"}
            onToggle={toggleAllVisible}
          />
          <span className={styles.bulkLabel}>
            {busy && deletingCount
              ? `Suppression ${deletingCount.done + 1}/${deletingCount.total}…`
              : selectedCount > 0
                ? `${selectedCount} gent${selectedCount > 1 ? "s" : ""} sélectionné${selectedCount > 1 ? "s" : ""}`
                : "Sélectionner pour supprimer plusieurs gents"}
          </span>
          {selectedCount > 0 && (
            <>
              <button type="button" className={styles.bulkClear} onClick={() => setSelected(new Set())} disabled={busy}>
                Annuler la sélection
              </button>
              <button type="button" className={styles.bulkDelete} onClick={() => void handleBulkDelete()} disabled={busy}>
                {busy ? "Suppression…" : `Supprimer${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
              </button>
            </>
          )}
        </div>
      )}

      {sessionExpiree && (
        <div className={styles.banner}>
          <strong>Accès serveur requis</strong> — sans la clé, seuls les gents de démo locaux
          s&apos;affichent.
          <div style={{ marginTop: 10 }}>
            <SessionExpiree next="/builder/mesgents" />
          </div>
        </div>
      )}

      {syncing && !sessionExpiree && <div className={styles.banner}>Synchronisation de vos gents…</div>}

      {orphanedPublished.length > 0 && (
        <div className={styles.banner}>
          <strong>Gents publiés retrouvés</strong> — le brouillon builder a pu disparaître après une mise à
          jour, mais l&apos;espace publié est toujours disponible.
        </div>
      )}

      {deleteError && <div className={styles.deleteError}>{deleteError}</div>}
      {noResults && <div className={styles.noResults}>Aucun gent ne correspond à « {query.trim()} ».</div>}

      {view === "tuile" ? (
        <div className={styles.grid}>
          {filteredDrafts.map((d) => (
            <div
              key={d.id}
              className={[styles.card, selected.has(d.id) ? styles.cardSelected : ""].filter(Boolean).join(" ")}
            >
              <div className={styles.checkAbs}>
                <SelectionCheck
                  checked={selected.has(d.id)}
                  disabled={busy}
                  label={`Sélectionner ${d.name || "ce gent"}`}
                  onToggle={() => toggleId(d.id)}
                />
              </div>
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
                  disabled={busy || deletingId === d.id}
                >
                  {deletingId === d.id ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}

          {filteredOrphans.map(({ id, espace }) => (
            <div
              key={id}
              className={[styles.card, styles.recoveryCard, selected.has(id) ? styles.cardSelected : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.checkAbs}>
                <SelectionCheck
                  checked={selected.has(id)}
                  disabled={busy}
                  label={`Sélectionner ${espace.gent || espace.name || "ce gent"}`}
                  onToggle={() => toggleId(id)}
                />
              </div>
              <div className={styles.cardTop}>
                <div className={styles.ic}>{espace.icon}</div>
                <div>
                  <div className={styles.name}>{espace.gent || espace.name}</div>
                  <span className={[styles.statusBadge, styles.statusPublished].join(" ")}>Publié (espace seul)</span>
                </div>
              </div>
              <p className={styles.objective}>Brouillon builder absent — restaurez-le pour continuer à l&apos;éditer.</p>
              <div className={styles.recoveryActions}>
                <a href={`/espace/${id}`} className={styles.recoveryLink}>
                  Ouvrir l&apos;espace
                </a>
                <button type="button" className={styles.recoveryBtn} onClick={() => handleRestore(id, espace)} disabled={busy}>
                  Restaurer
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(id, espace.gent || espace.name)}
                  disabled={busy || deletingId === id}
                >
                  {deletingId === id ? "Suppression…" : "Supprimer"}
                </button>
              </div>
            </div>
          ))}

          <button className={[styles.card, styles.newCard].join(" ")} onClick={handleCreateNew}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouveau gent
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredDrafts.map((d) => (
            <div
              key={d.id}
              className={[styles.row, selected.has(d.id) ? styles.cardSelected : ""].filter(Boolean).join(" ")}
            >
              <SelectionCheck
                checked={selected.has(d.id)}
                disabled={busy}
                label={`Sélectionner ${d.name || "ce gent"}`}
                onToggle={() => toggleId(d.id)}
              />
              <a href={`/builder/${d.id}`} className={styles.rowLink}>
                <div className={styles.ic}>{d.icon}</div>
                <span className={styles.rowName}>{d.name}</span>
                <span className={[styles.statusBadge, STATUS_CLASS[d.status]].join(" ")}>
                  {STATUS_LABEL[d.status]}
                </span>
              </a>
              <span className={styles.rowMeta}>Mis à jour {d.updatedAt}</span>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(d.id, d.name || "ce gent")}
                disabled={busy || deletingId === d.id}
              >
                {deletingId === d.id ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          ))}

          {filteredOrphans.map(({ id, espace }) => (
            <div
              key={id}
              className={[styles.row, styles.recoveryCard, selected.has(id) ? styles.cardSelected : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <SelectionCheck
                checked={selected.has(id)}
                disabled={busy}
                label={`Sélectionner ${espace.gent || espace.name || "ce gent"}`}
                onToggle={() => toggleId(id)}
              />
              <a href={`/espace/${id}`} className={styles.rowLink}>
                <div className={styles.ic}>{espace.icon}</div>
                <span className={styles.rowName}>{espace.gent || espace.name}</span>
                <span className={[styles.statusBadge, styles.statusPublished].join(" ")}>Publié (espace seul)</span>
              </a>
              <button type="button" className={styles.recoveryBtn} onClick={() => handleRestore(id, espace)} disabled={busy}>
                Restaurer
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(id, espace.gent || espace.name)}
                disabled={busy || deletingId === id}
              >
                {deletingId === id ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
