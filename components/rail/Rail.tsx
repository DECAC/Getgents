"use client";

import { useRouter } from "next/navigation";
import { useEspace } from "@/lib/context/EspaceContext";
import { cn } from "@/lib/utils";

const STATUS_DOT_CLASS: Record<string, string> = {
  live: "bg-primary",
  paused: "bg-secondary-foreground",
  done: "bg-faint",
};

export function Rail() {
  const { espaces, currentId, railCollapsed, toggleRail, switchEspace } = useEspace();
  const router = useRouter();

  function handleSwitch(id: string) {
    switchEspace(id);
    router.push(`/espace/${id}`);
  }

  return (
    <nav
      className="relative flex min-h-0 flex-col overflow-hidden border-r border-border bg-card"
      aria-label="Mes gents actifs"
      id="rail"
    >
      <div
        className={cn(
          "flex flex-shrink-0 items-center gap-[9px] px-4 pb-3.5 pt-[18px]",
          railCollapsed && "flex-col gap-3.5 px-0 pt-4 pb-3.5"
        )}
      >
        <div className="relative h-[26px] w-[26px] flex-none rounded-[7px] bg-primary before:absolute before:left-[7px] before:top-[11px] before:h-0.5 before:w-[11px] before:rounded-sm before:bg-white after:absolute after:left-3 after:top-[7px] after:h-[11px] after:w-0.5 after:rounded-sm after:bg-secondary" />
        {!railCollapsed && (
          <h1 className="m-0 overflow-hidden whitespace-nowrap font-display text-lg font-bold tracking-tight">
            Getgents
          </h1>
        )}
        <button
          className={cn(
            "ml-auto grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] text-muted-foreground hover:bg-background hover:text-foreground",
            railCollapsed && "ml-0"
          )}
          onClick={toggleRail}
          aria-label={railCollapsed ? "Déployer la colonne" : "Réduire la colonne"}
          title={railCollapsed ? "Déployer" : "Réduire"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="transition-transform duration-200"
            style={{ transform: railCollapsed ? "rotate(180deg)" : undefined }}
          >
            <path d="M14 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      {!railCollapsed && (
        <div className="flex-shrink-0 overflow-hidden whitespace-nowrap px-[18px] pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Mes gents actifs
        </div>
      )}

      <ul
        className={cn("min-h-0 flex-1 list-none overflow-y-auto overflow-x-hidden px-2 py-0", railCollapsed && "px-0 py-1.5")}
        role="list"
      >
        {Object.entries(espaces).map(([id, e]) => (
          <li key={id}>
            <button
              className={cn(
                "mb-0.5 flex w-full items-start gap-[11px] rounded-lg px-[10px] py-[11px] text-left transition-colors hover:bg-background",
                id === currentId && "bg-primary-tint",
                railCollapsed && "justify-center px-0 py-[10px]"
              )}
              onClick={() => handleSwitch(id)}
              title={e.name}
              aria-current={id === currentId ? "page" : undefined}
            >
              <span
                className={cn(
                  "grid h-[30px] w-[30px] flex-none place-items-center rounded-lg border border-border bg-white text-[15px]",
                  id === currentId && "border-primary"
                )}
              >
                {e.icon}
              </span>
              {!railCollapsed && (
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold leading-tight tracking-tight">
                    {e.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-muted-foreground">
                    <span className={cn("h-[7px] w-[7px] flex-none rounded-full", STATUS_DOT_CLASS[e.status])} />
                    {e.statusLabel} · {e.gent}
                  </span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <a
        href="/decouvrir"
        title="Découvrir des gents"
        className={cn(
          "m-2 flex items-center gap-2 whitespace-nowrap rounded-lg border border-dashed border-border px-3.5 py-[11px] text-[13px] font-semibold text-primary-hover no-underline hover:border-primary hover:bg-primary-tint",
          railCollapsed && "justify-center px-0 py-[11px]"
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        {!railCollapsed && <span className="overflow-hidden text-ellipsis">Découvrir des gents</span>}
      </a>

      <div
        className={cn(
          "flex flex-shrink-0 items-center gap-2.5 overflow-hidden border-t border-muted px-4 py-3",
          railCollapsed && "justify-center px-0"
        )}
        title="Camille Léaud"
      >
        <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-accent-tint text-xs font-semibold text-accent-foreground">
          CL
        </div>
        {!railCollapsed && (
          <div className="min-w-0 overflow-hidden whitespace-nowrap">
            <div className="overflow-hidden text-ellipsis text-[12.5px] font-semibold">Camille Léaud</div>
            <div className="overflow-hidden text-ellipsis text-[11px] text-muted-foreground">
              Forfait Gents · 3 actifs
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
