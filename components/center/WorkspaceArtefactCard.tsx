"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { Artefact } from "@/lib/types";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTMLDoc } from "@/components/shared/SafeHTML";
import { ImageArtefact } from "@/components/shared/ImageArtefact";
import { ProfileSummaryArtefact } from "@/components/shared/ProfileSummaryArtefact";
import { MiniBarChart } from "@/components/shared/MiniBarChart";
import { ChecklistView } from "@/components/shared/ChecklistView";
import { MapArtefact } from "@/components/shared/MapArtefact";
import { DashboardArtefact } from "@/components/shared/dashboard/DashboardArtefact";
import { ReportArtefact } from "@/components/shared/ReportArtefact";
import { ArtefactWorkspaceActions } from "@/components/shared/ArtefactWorkspaceActions";
import { hasReportBody } from "@/lib/reportArtefact";
import previewStyles from "@/components/appPreview/AppPreview.module.css";
import styles from "./WorkspaceArtefactCard.module.css";

export function WorkspaceArtefactCard({
  artefact,
  sizeClass,
}: {
  artefact: Artefact;
  sizeClass: string;
}) {
  const { openArtefactModal, toggleChecklistItem, userPosition, generateProfileSummaryMedia } = useEspace();

  function onCardClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, input, select, textarea, label")) return;
    openArtefactModal(artefact.id);
  }

  return (
    <article
      className={`${previewStyles.card} ${sizeClass} ${styles.card}`}
      onClick={onCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openArtefactModal(artefact.id);
        }
      }}
    >
      <header className={previewStyles.head}>
        <div className={previewStyles.glyph} aria-hidden="true">
          {artefact.icon}
        </div>
        <div className={previewStyles.headText}>
          <div className={previewStyles.title}>{artefact.title}</div>
          <div className={previewStyles.meta}>{artefact.type}</div>
        </div>
        <ArtefactWorkspaceActions artefact={artefact} />
      </header>
      <div className={`${previewStyles.body} ${styles.body}`}>
        {artefact.dashboard && <DashboardArtefact spec={artefact.dashboard} />}
        {artefact.profileSummary && (
          <ProfileSummaryArtefact
            summary={artefact.profileSummary}
            artefactId={artefact.id}
            canGenerate
            onGenerateMedia={(mediaId) => generateProfileSummaryMedia(artefact.id, mediaId)}
            compact
          />
        )}
        {artefact.imageUrl && (
          <ImageArtefact
            embedded
            src={artefact.imageUrl}
            alt={artefact.title}
            caption={artefact.imageCaption}
            source={artefact.imageSource}
          />
        )}
        {artefact.chartData && <MiniBarChart data={artefact.chartData} />}
        {artefact.mapPoints && <MapArtefact points={artefact.mapPoints} userPosition={userPosition} />}
        {artefact.checklistItems && (
          <ChecklistView items={artefact.checklistItems} onToggle={(i) => toggleChecklistItem(artefact.id, i)} />
        )}
        {hasReportBody(artefact) ? (
          <ReportArtefact artefact={artefact} />
        ) : (
          artefact.body && !artefact.imageUrl && !artefact.profileSummary && <SafeHTMLDoc html={artefact.body} />
        )}
      </div>
    </article>
  );
}
