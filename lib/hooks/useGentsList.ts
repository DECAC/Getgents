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
import { confirmDeleteGentsMessage, deleteGentEverywhere } from "@/lib/deleteGent";
import type { GentDraft } from "@/lib/types/builder";
import type { Espace } from "@/lib/types";

function computeOrphans(visible: GentDraft[]): { id: string; espace: Espace }[] {
  const draftIds = new Set(visible.map((d) => d.id));
  const published = readPublishedGents();
  return Object.entries(published)
    .filter(([id]) => !draftIds.has(id))
    .map(([id, espace]) => ({ id, espace }));
}

/**
 * Logique de la liste des gents (Gent'space) — partagée entre la page
 * dédiée (/builder) et l'onglet « Mes gents » à l'intérieur du studio, pour
 * ne pas dupliquer la synchronisation, la recherche et la suppression.
 */
export function useGentsList() {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => listVisibleDrafts());
  const [orphanedPublished, setOrphanedPublished] = useState<{ id: string; espace: Espace }[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [needsAccessKey, setNeedsAccessKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCount, setDeletingCount] = useState<{ done: number; total: number } | null>(null);
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
      const [remoteDrafts, remotePublished] = await Promise.all([
        syncDraftsFromRemote(),
        syncPublishedGentsFromRemote(),
      ]);
      if (remoteDrafts === "unauthorized" || remotePublished === "unauthorized") {
        setNeedsAccessKey(true);
      } else if (remoteDrafts !== null || remotePublished !== null) {
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
  const noResults = normalizedQuery.length > 0 && filteredDrafts.length === 0 && filteredOrphans.length === 0;

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

  async function handleDeleteMany(items: { id: string; name: string }[]) {
    const unique = items.filter((item, i, all) => all.findIndex((x) => x.id === item.id) === i);
    if (unique.length === 0) return "cancelled";
    if (!window.confirm(confirmDeleteGentsMessage(unique.map((i) => i.name)))) return "cancelled";
    setDeleteError(null);
    const failed: string[] = [];
    setDeletingCount({ done: 0, total: unique.length });
    try {
      for (let i = 0; i < unique.length; i++) {
        const item = unique[i];
        setDeletingId(item.id);
        setDeletingCount({ done: i, total: unique.length });
        const result = await deleteGentEverywhere(item.id);
        if (!result.ok) {
          failed.push(`« ${item.name || "ce gent"} » (${result.error ?? "erreur inconnue"})`);
        }
      }
      if (failed.length) {
        setDeleteError(
          failed.length === unique.length
            ? `Aucun gent n'a pu être supprimé : ${failed.join(" · ")}`
            : `Certains gents n'ont pas été supprimés : ${failed.join(" · ")}`
        );
      }
      refreshLists();
    } finally {
      setDeletingId(null);
      setDeletingCount(null);
    }
    return failed.length === 0 ? "ok" : "partial";
  }

  async function handleDelete(id: string, name: string) {
    await handleDeleteMany([{ id, name }]);
  }

  return {
    query,
    setQuery,
    filteredDrafts,
    filteredOrphans,
    noResults,
    orphanedPublished,
    syncing,
    needsAccessKey,
    deletingId,
    deletingCount,
    deleteError,
    hydrateFromRemote,
    refreshLists,
    handleRestore,
    handleDelete,
    handleDeleteMany,
  };
}
