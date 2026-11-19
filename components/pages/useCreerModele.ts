"use client";

import { useState } from "react";
import type { IdExemple } from "@/lib/exemplesPages";

/** Crée (ou rouvre) la page d'un modèle, puis ouvre sa fiche. */
export function useCreerModele() {
  const [enCours, setEnCours] = useState<IdExemple | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(id: IdExemple) {
    setEnCours(id);
    setErreur(null);
    const r = await fetch("/api/pages/exemple", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exemple: id }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (r?.ok && j?.id) {
      window.location.assign(`/pages/${j.id}`);
      return;
    }
    setErreur(j?.error ?? "Le modèle n'a pas pu être créé. Réessayez.");
    setEnCours(null);
  }

  return { enCours, erreur, creer };
}
