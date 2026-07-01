import type { EspaceTab } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function TimelineTab({ tab }: { tab: EspaceTab }) {
  const steps = tab.steps ?? [];
  return (
    <div className="mx-auto max-w-[680px]">
      <Card className="p-[18px]">
        <h4 className="m-0 mb-[3px] font-display text-[15px] tracking-tight">{tab.name}</h4>
        <div className="mb-4 text-xs text-muted-foreground">{tab.sub}</div>
        <div className="relative pl-[30px] before:absolute before:left-[11px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-border">
          {steps.map((step) => (
            <div key={step.day} className="relative pb-[22px] last:pb-0">
              <div
                className={cn(
                  "absolute -left-[30px] top-0 grid h-6 w-6 place-items-center rounded-full border-[3px] border-card bg-primary font-mono text-[11px] font-semibold text-white",
                  step.status === "future" && "border-border bg-background text-muted-foreground"
                )}
              >
                {step.day}
              </div>
              <div className="text-[14.5px] font-bold tracking-tight">{step.city}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{step.night}</div>
              <div className="mt-[7px] flex flex-wrap gap-1.5">
                {step.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded-md bg-primary-tint px-2 py-1 text-[10.5px] font-semibold text-primary-hover",
                      step.status === "future" && "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
