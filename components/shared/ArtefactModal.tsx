"use client";

import { useCallback, useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTMLDoc } from "./SafeHTML";
import { MiniBarChart } from "./MiniBarChart";
import { ChecklistView } from "./ChecklistView";
import { MapArtefact } from "./MapArtefact";
import { DashboardArtefact } from "./dashboard/DashboardArtefact";
import { ReportArtefact } from "./ReportArtefact";
import { ImageArtefact } from "./ImageArtefact";
import { ProfileSummaryArtefact } from "./ProfileSummaryArtefact";
import { ArtefactWorkspaceActions } from "./ArtefactWorkspaceActions";
import { hasReportBody } from "@/lib/reportArtefact";
import styles from "./Modal.module.css";

function VisualGrid() {
  return (
    <div className={styles.visualGrid}>
      <div>
        <svg viewBox="0 0 200 190">
          <rect width="200" height="190" fill="#CFE0DD" />
          <rect y="120" width="200" height="70" fill="#A9C6BE" />
          <rect x="20" y="80" width="26" height="44" fill="#E8C66B" />
          <rect x="52" y="70" width="26" height="54" fill="#E0A05C" />
          <rect x="84" y="88" width="26" height="36" fill="#D88B7A" />
          <rect x="116" y="74" width="26" height="50" fill="#E8C66B" />
          <rect x="148" y="92" width="26" height="32" fill="#C97A6A" />
          <circle cx="160" cy="35" r="16" fill="#F2DDA0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#B9D4D8" />
          <path d="M0 60 L30 35 L60 55 L95 30 L95 90 L0 90 Z" fill="#7FA8A0" />
        </svg>
      </div>
      <div>
        <svg viewBox="0 0 95 90">
          <rect width="95" height="90" fill="#E4D9C4" />
          <circle cx="48" cy="45" r="22" fill="none" stroke="#B7956A" strokeWidth="3" />
          <path d="M20 70 Q48 50 76 70" fill="none" stroke="#9C7B52" strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
}

export function ArtefactModal() {
  const {
    currentEspace,
    modalArtefactId,
    pendingArtefactVerdict,
    closeModal,
    toggleChecklistItem,
    userPosition,
    removeArtefact,
    generateProfileSummaryMedia,
    confirmArtefactProposal,
  } = useEspace();

  const isVerdict = !!pendingArtefactVerdict;
  const artefact = pendingArtefactVerdict
    ? pendingArtefactVerdict.preview
    : modalArtefactId
      ? currentEspace.artefacts.find((a) => a.id === modalArtefactId) ?? null
      : null;

  // Fermer sans choisir = Jeter : évite de laisser l'espace pollué ou
  // l'utilisateur coincé avec une popup sans décision.
  const dismissOrClose = useCallback(() => {
    if (pendingArtefactVerdict) {
      confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "dismiss");
      return;
    }
    closeModal();
  }, [pendingArtefactVerdict, confirmArtefactProposal, closeModal]);

  useEffect(() => {
    if (artefact) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [artefact]);

  useEffect(() => {
    if (!artefact) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissOrClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [artefact, dismissOrClose]);

  if (!artefact) return null;

  const isDashboard = !!artefact.dashboard;
  const isReport = hasReportBody(artefact);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) dismissOrClose(); }}
    >
      <div className={[styles.modal, isDashboard || isReport ? styles.modalWide : ""].filter(Boolean).join(" ")}>
        <div className={styles.head}>
          <div
            className={styles.ti}
            dangerouslySetInnerHTML={{ __html: artefact.icon }}
          />
          <div>
            <h3 className={styles.title} id="modal-title">{artefact.title}</h3>
            <div className={styles.meta}>
              <span className={styles.typePill}>{artefact.type}</span>
              <span>{artefact.date}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={dismissOrClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {artefact.dashboard && <DashboardArtefact spec={artefact.dashboard} />}
          {artefact.profileSummary && (
            <ProfileSummaryArtefact
              summary={artefact.profileSummary}
              artefactId={artefact.id}
              canGenerate={!isVerdict}
              onGenerateMedia={
                isVerdict
                  ? undefined
                  : (mediaId) => generateProfileSummaryMedia(artefact.id, mediaId)
              }
            />
          )}
          {artefact.imageUrl && (
            <ImageArtefact
              src={artefact.imageUrl}
              alt={artefact.title}
              caption={artefact.imageCaption}
              source={artefact.imageSource}
            />
          )}
          {artefact.visual && !artefact.imageUrl && !artefact.profileSummary && (
            <div className={styles.visualWrap}>
              <VisualGrid />
            </div>
          )}
          {artefact.chartData && <MiniBarChart data={artefact.chartData} />}
          {artefact.mapPoints && <MapArtefact points={artefact.mapPoints} height={380} userPosition={userPosition} />}
          {artefact.checklistItems && (
            <ChecklistView
              items={artefact.checklistItems}
              onToggle={isVerdict ? () => undefined : (i) => toggleChecklistItem(artefact.id, i)}
            />
          )}
          {isReport ? (
            <ReportArtefact artefact={artefact} />
          ) : (
            artefact.body && !artefact.imageUrl && !artefact.profileSummary && (
              <SafeHTMLDoc html={artefact.body} />
            )
          )}
        </div>

        {isVerdict && pendingArtefactVerdict ? (
          <div className={[styles.foot, styles.footVerdict].join(" ")}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "dismiss")}
            >
              Jeter
            </button>
            <button
              type="button"
              className={styles.btnPrim}
              onClick={() => confirmArtefactProposal(pendingArtefactVerdict.proposalMessageId, "add")}
            >
              Garder dans l&apos;espace
            </button>
          </div>
        ) : (
          <div className={styles.foot}>
            <span className={styles.footLabel}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
              </svg>
              Généré par Getgents · gabarit standard
            </span>
            <button className={styles.btnGhost} onClick={() => removeArtefact(artefact.id)}>
              Retirer de l&apos;espace
            </button>
            <ArtefactWorkspaceActions artefact={artefact} showEnlarge={false} labeled />
            <button className={styles.btnGhost} onClick={() => alert("Export PDF — non implémenté dans ce commit.")}>
              Exporter en PDF
            </button>
            <button className={styles.btnPrim} onClick={() => alert("Mise à jour — non implémentée dans ce commit.")}>
              Mettre à jour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
