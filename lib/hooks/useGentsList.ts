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

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `Supprimer définitivement « ${name} » ? Cette action est irréversible : le brouillon, le gent publié et ses liens de partage seront effacés.`
      )
    ) {
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
    deleteError,
    hydrateFromRemote,
    refreshLists,
    handleRestore,
    handleDelete,
  };
}
