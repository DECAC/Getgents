"use client";

import { useRef, useCallback } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { canResizeAssist, setAssistWidthFromPointer } from "@/lib/assistResize";
import { CenterHeader } from "./CenterHeader";
import { ModuleCanvas } from "./ModuleCanvas";
import styles from "./Center.module.css";

export function Center() {
  const { currentEspace, currentId, openAssistant, closeAssistant, assistantOpen } = useEspace();
  const pullTabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0 });
  const suppressClickRef = useRef(false);

  const handlePullTabClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (assistantOpen) closeAssistant();
    else openAssistant();
  }, [assistantOpen, closeAssistant, openAssistant]);

  const handlePullTabPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!assistantOpen || !canResizeAssist()) return;
      dragRef.current = { active: true, moved: false, startX: e.clientX };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [assistantOpen]
  );

  const handlePullTabPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current.active || !assistantOpen) return;
      if (Math.abs(e.clientX - dragRef.current.startX) > 4) {
        if (!dragRef.current.moved) {
          dragRef.current.moved = true;
          document.body.classList.add("col-resizing");
          pullTabRef.current?.classList.add(styles.pullTabResizing);
        }
        setAssistWidthFromPointer(e.clientX);
      }
    },
    [assistantOpen]
  );

  const endPullTabDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return;
    if (dragRef.current.moved) {
      suppressClickRef.current = true;
      document.body.classList.remove("col-resizing");
      pullTabRef.current?.classList.remove(styles.pullTabResizing);
    }
    dragRef.current = { active: false, moved: false, startX: 0 };
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return (
    <main className={styles.center} id="main-content">
      <div className={styles.mobtabs}>
        <button className={styles.mobBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Gents
        </button>
        <button className={styles.mobBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h18M3 12h18M3 17h10" />
          </svg>
          Mémoire & fichiers
        </button>
      </div>

      <CenterHeader />

      <div className={styles.content} tabIndex={-1}>
        {/* key force la réinitialisation de l'agencement quand on change d'espace */}
        <ModuleCanvas key={currentId} espace={currentEspace} />
      </div>

      <button
        ref={pullTabRef}
        type="button"
        className={[styles.pullTab, assistantOpen ? styles.pullTabOpen : ""].filter(Boolean).join(" ")}
        onClick={handlePullTabClick}
        onPointerDown={handlePullTabPointerDown}
        onPointerMove={handlePullTabPointerMove}
        onPointerUp={endPullTabDrag}
        onPointerCancel={endPullTabDrag}
        aria-haspopup="dialog"
        aria-expanded={assistantOpen}
        title={
          assistantOpen
            ? "Glisser pour redimensionner · clic pour réduire"
            : "Parler à votre assistant"
        }
      >
        <span className={styles.pullTabGrip} aria-hidden="true" />
        {assistantOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        <span className={styles.pullTabLabelWrap}>
          <span className={styles.pullTabLabel}>
            {assistantOpen ? "Réduire" : "Parler à votre assistant"}
          </span>
        </span>
      </button>
    </main>
  );
}
