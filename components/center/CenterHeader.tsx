"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  live: "bg-primary-tint text-primary-hover",
  paused: "bg-secondary text-secondary-foreground",
  done: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<string, string> = {
  live: "bg-primary",
  paused: "bg-secondary-foreground",
  done: "bg-faint",
};

const TAB_ICONS = {
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M12 7v3M12 14v3" />
    </svg>
  ),
  resv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l2 2 4-4" />
      <rect x="3" y="4" width="18" height="16" rx="2" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  ),
};

export function CenterHeader() {
  const { currentEspace, activeTab, switchTab } = useEspace();
  const e = currentEspace;

  return (
    <header className="flex-none border-b border-border bg-card px-[22px] pt-3.5">
      <div className="flex items-start gap-3.5">
        <div className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[11px] bg-primary-tint text-[21px]">
          {e.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-display text-[21px] font-bold leading-tight tracking-tight">
            {e.name}
          </h2>
          <div className="mt-[3px] text-[12.5px] text-muted-foreground">
            Propulsé par <b className="font-semibold text-foreground">{e.gent}</b> · version {e.version}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11.5px] font-semibold",
            STATUS_CLASS[e.status]
          )}
        >
          <span className={cn("h-[7px] w-[7px] flex-none rounded-full", DOT_CLASS[e.status])} />
          {e.statusLabel}
        </span>
      </div>

      <div className="mb-0.5 mt-[11px] flex flex-wrap gap-[7px]">
        <Badge variant="neutral">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          Interaction IA
        </Badge>

        {e.sensitive && (
          <Badge variant="accent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Données sensibles
          </Badge>
        )}

        {e.integrations.map((intg, i) => (
          <button
            key={i}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-semibold [&_svg]:h-3 [&_svg]:w-3",
              intg.action
                ? "border-transparent bg-secondary text-secondary-foreground hover:border-secondary-foreground"
                : "border-border bg-white text-muted-foreground hover:border-primary hover:text-primary-hover"
            )}
            onClick={() => switchTab("tools")}
            title={intg.action ? "Action engageante — voir dans Tools" : "Lecture seule — voir dans Tools"}
          >
            {intg.action ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
              </svg>
            )}
            {intg.label}
          </button>
        ))}
      </div>

      {(e.tabs.length > 0 || e.map || e.tools.length > 0) && (
        <div className="mt-3 flex gap-0.5 overflow-x-auto" role="tablist">
          {e.tabs.map((tab, i) => (
            <button
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-[13px] py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-background hover:text-foreground",
                activeTab === i && "border-primary font-semibold text-primary-hover"
              )}
              onClick={() => switchTab(i)}
              role="tab"
              aria-selected={activeTab === i}
            >
              <span className="block h-3.5 w-3.5 flex-none [&_svg]:h-3.5 [&_svg]:w-3.5">{TAB_ICONS[tab.kind]}</span>
              {tab.name}
            </button>
          ))}

          {e.map && (
            <button
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-[13px] py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-background hover:text-foreground",
                activeTab === "map" && "border-primary font-semibold text-primary-hover"
              )}
              onClick={() => switchTab("map")}
              role="tab"
              aria-selected={activeTab === "map"}
            >
              <span className="block h-3.5 w-3.5 flex-none [&_svg]:h-3.5 [&_svg]:w-3.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
                  <path d="M9 4v14M15 6v14" />
                </svg>
              </span>
              Carte
            </button>
          )}

          {e.tools.length > 0 && (
            <button
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-[13px] py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-background hover:text-foreground",
                activeTab === "tools" && "border-primary font-semibold text-primary-hover"
              )}
              onClick={() => switchTab("tools")}
              role="tab"
              aria-selected={activeTab === "tools"}
            >
              <span className="block h-3.5 w-3.5 flex-none [&_svg]:h-3.5 [&_svg]:w-3.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
                </svg>
              </span>
              Tools
            </button>
          )}
        </div>
      )}
    </header>
  );
}
