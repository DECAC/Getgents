"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { Tool } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CAT_LABEL: Record<string, string> = {
  lecture: "Lecture seule",
  ecriture: "Écriture — confirmation requise",
  compte_tiers: "Compte tiers — vous payez là-bas",
};

const TIC_CLASS: Record<string, string> = {
  lecture: "bg-muted text-muted-foreground",
  ecriture: "bg-secondary text-secondary-foreground",
  compte_tiers: "bg-accent text-accent-foreground",
};

const RISK_CLASS: Record<string, string> = {
  lecture: "bg-muted text-muted-foreground",
  ecriture: "bg-secondary text-secondary-foreground",
  compte_tiers: "bg-accent text-accent-foreground",
};

export function ToolsTab({ tools }: { tools: Tool[] }) {
  const { connectTool } = useEspace();

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-[18px] text-center text-[11px] font-medium tracking-wide text-faint">
        — Tools de ce gent —
      </div>
      <div className="flex flex-col gap-2.5">
        {tools.map((tool) => (
          <Card key={tool.id} className="flex items-start gap-3 px-[15px] py-[13px]">
            <div className={cn("grid h-[34px] w-[34px] flex-none place-items-center rounded-lg text-base", TIC_CLASS[tool.category])}>
              {tool.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold tracking-tight">
                {tool.name}
                <span
                  className={cn(
                    "rounded-full px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide",
                    RISK_CLASS[tool.category]
                  )}
                >
                  {CAT_LABEL[tool.category]}
                </span>
              </div>
              <div className="mt-[3px] text-xs leading-snug text-muted-foreground">{tool.desc}</div>
            </div>
            {tool.category === "compte_tiers" &&
              (tool.connected ? (
                <span className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-tint px-[13px] py-[7px] text-xs font-semibold text-primary-hover">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Connecté
                </span>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  className="flex-none whitespace-nowrap"
                  onClick={() => connectTool(tool.name)}
                >
                  Connecter
                </Button>
              ))}
          </Card>
        ))}
      </div>
      <div className="mt-1 flex gap-[9px] rounded-[10px] bg-background p-3.5 text-xs leading-relaxed text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px flex-none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          Getgents ne déclenche jamais de paiement et ne stocke aucun moyen de paiement. Pour les
          comptes tiers connectés, chaque proposition reste soumise à votre validation explicite, et
          le paiement se fait toujours chez le prestataire — jamais sur Getgents.
        </span>
      </div>
    </div>
  );
}
