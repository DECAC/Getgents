"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { allocateNewDraft, listVisibleDrafts } from "@/lib/builderDraftStorage";

/**
 * /builder n'affiche plus de tableau de bord séparé : la liste des gents vit
 * désormais dans l'onglet « Mes gents » du studio (voir MesGentsTab). On
 * atterrit donc directement sur le gent le plus récent avec cet onglet actif
 * — sinon on en crée un pour ne jamais laisser cette route vide.
 */
export default function BuilderPage() {
  const router = useRouter();

  useEffect(() => {
    const drafts = listVisibleDrafts();
    const id = drafts[0]?.id ?? allocateNewDraft();
    router.replace(`/builder/${id}?tab=mesgents`);
  }, [router]);

  return null;
}
