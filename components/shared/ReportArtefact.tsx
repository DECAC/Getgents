"use client";

import type { Artefact } from "@/lib/types";
import { reportSpecFromArtefact } from "@/lib/reportArtefact";
import { DashboardArtefact } from "./dashboard/DashboardArtefact";
import { SafeHTMLDoc } from "./SafeHTML";

/**
 * Rapport dans le langage visuel actuel (mêmes blocs que le tableau de bord :
 * titres à barre, grilles étiquette/valeur, encadrés). Les anciens HTML
 * `.gendoc` sont adaptés à la volée.
 */
export function ReportArtefact({ artefact }: { artefact: Artefact }) {
  const spec = reportSpecFromArtefact(artefact);
  if (!spec) {
    return artefact.body ? <SafeHTMLDoc html={artefact.body} /> : null;
  }
  return <DashboardArtefact spec={spec} />;
}
