"use client";

import { AppPreview } from "@/components/appPreview/AppPreview";
import { ModuleCanvas } from "./ModuleCanvas";
import type { Espace } from "@/lib/types";

/**
 * Canevas de l'espace : le nouveau rendu (onglets + modules à blocs) dès
 * qu'un aperçu a été généré dans le studio, sinon l'ancien canevas
 * d'artefacts — pour que Preview montre la même application que l'onglet
 * Aperçu, et que les gents sans aperçu continuent de fonctionner.
 */
export function WorkspaceCanvas({ espace }: { espace: Espace }) {
  if (espace.appPreview?.modules.length) {
    return <AppPreview spec={espace.appPreview} variant="workspace" />;
  }
  return <ModuleCanvas espace={espace} />;
}
