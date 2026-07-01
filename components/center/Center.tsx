"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import { cn } from "@/lib/utils";
import { CenterHeader } from "./CenterHeader";
import { TimelineTab } from "./tabs/TimelineTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { MapTab } from "./tabs/MapTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { EmptyCenter } from "./EmptyCenter";

export function Center() {
  const { currentEspace, activeTab, openAssistant, closeAssistant, assistantOpen } = useEspace();

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
    <main className="relative flex min-h-0 flex-col overflow-hidden bg-background" id="main-content">
      <div className="hidden gap-2 px-4 pt-2.5 max-[860px]:flex">
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-0 py-2.5 text-[12.5px] font-semibold">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Gents
        </button>
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-0 py-2.5 text-[12.5px] font-semibold">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h18M3 12h18M3 17h10" />
          </svg>
          Mémoire & fichiers
        </button>
      </div>

      <CenterHeader />

      <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-2 pt-6" tabIndex={-1}>
        {renderContent()}
      </div>

      <button
        className={cn(
          "absolute left-0 top-1/2 z-[80] flex w-[46px] min-h-[188px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3.5 rounded-[23px] border border-white/[0.14] bg-primary py-5 text-white shadow-pop transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-[calc(50%+2px)] hover:bg-primary-hover hover:shadow-[0_10px_28px_rgba(36,74,58,0.45)]",
          assistantOpen && "min-h-[96px] gap-2.5",
          "max-[860px]:fixed max-[860px]:bottom-5 max-[860px]:right-5 max-[860px]:left-auto max-[860px]:top-auto max-[860px]:min-h-0 max-[860px]:w-auto max-[860px]:translate-x-0 max-[860px]:translate-y-0 max-[860px]:flex-row max-[860px]:rounded-[28px] max-[860px]:px-4 max-[860px]:py-3.5 max-[860px]:hover:translate-y-[-2px]"
        )}
        onClick={assistantOpen ? closeAssistant : openAssistant}
        aria-haspopup="dialog"
        aria-expanded={assistantOpen}
        title={assistantOpen ? "Réduire la fenêtre d'échange" : "Parler à votre assistant"}
      >
        <span
          className="h-[3px] w-4 flex-none rounded-sm bg-white/60 shadow-[0_7px_0_rgba(255,255,255,0.6),0_-7px_0_rgba(255,255,255,0.6)] max-[860px]:hidden"
          aria-hidden="true"
        />
        {assistantOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        <span className="rotate-180 whitespace-nowrap text-[13.5px] font-bold tracking-wide [writing-mode:vertical-rl] [text-shadow:0_1px_2px_rgba(0,0,0,0.18)] max-[860px]:rotate-0 max-[860px]:[writing-mode:horizontal-tb]">
          {assistantOpen ? "Réduire" : "Parler à votre assistant"}
        </span>
      </button>
    </main>
  );
}
