"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import { CenterHeader } from "./CenterHeader";
import { TimelineTab } from "./tabs/TimelineTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { MapTab } from "./tabs/MapTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { EmptyCenter } from "./EmptyCenter";
import styles from "./Center.module.css";

export function Center() {
  const { currentEspace, activeTab, openAssistant, assistantOpen } = useEspace();

  function renderContent() {
    if (activeTab === "map" && currentEspace.map) return <MapTab map={currentEspace.map} />;
    if (activeTab === "tools") return <ToolsTab tools={currentEspace.tools} />;

    const tab = currentEspace.tabs[activeTab as number];
    if (!tab) return <EmptyCenter espace={currentEspace} />;
    if (tab.kind === "timeline") return <TimelineTab tab={tab} />;
    if (tab.kind === "resv") return <ReservationsTab tab={tab} />;
    if (tab.kind === "chart") return <BudgetTab tab={tab} />;
    return <EmptyCenter espace={currentEspace} />;
  }

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
        {renderContent()}
      </div>

      {!assistantOpen && (
        <button className={styles.fab} onClick={openAssistant} aria-haspopup="dialog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span>Parler à votre assistant</span>
        </button>
      )}
    </main>
  );
}
