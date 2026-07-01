"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { EspaceTab, ReservationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  pending: "À envoyer",
  sent: "Envoyé — à valider",
  confirmed: "Confirmé",
  cancelled: "Écarté",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  sent: "bg-accent text-accent-foreground",
  confirmed: "bg-primary-tint text-primary-hover",
  cancelled: "bg-muted text-muted-foreground",
};

const IC_CLASS: Record<string, string> = {
  pending: "bg-secondary",
  sent: "bg-accent",
  confirmed: "bg-primary-tint",
  cancelled: "bg-muted",
};

export function ReservationsTab({ tab }: { tab: EspaceTab }) {
  const { openResvModal } = useEspace();
  const items: ReservationItem[] = tab.items ?? [];

  const counts = { pending: 0, sent: 0, confirmed: 0 };
  items.forEach((it) => {
    if (it.status in counts) counts[it.status as keyof typeof counts]++;
  });

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="mb-4 flex flex-wrap gap-2.5">
        <Card className="min-w-[120px] flex-1 px-3.5 py-3">
          <div className="font-display text-[22px] font-bold tracking-tight text-secondary-foreground">
            {counts.pending}
          </div>
          <div className="mt-px text-[11px] text-muted-foreground">À envoyer</div>
        </Card>
        <Card className="min-w-[120px] flex-1 px-3.5 py-3">
          <div className="font-display text-[22px] font-bold tracking-tight text-accent-foreground">
            {counts.sent}
          </div>
          <div className="mt-px text-[11px] text-muted-foreground">Envoyées</div>
        </Card>
        <Card className="min-w-[120px] flex-1 px-3.5 py-3">
          <div className="font-display text-[22px] font-bold tracking-tight text-primary-hover">
            {counts.confirmed}
          </div>
          <div className="mt-px text-[11px] text-muted-foreground">Confirmées</div>
        </Card>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.length === 0 ? (
          <div className="rounded-xl bg-background p-5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
            Aucune proposition pour l&apos;instant. Le gent en déposera ici dès qu&apos;il en trouvera une pertinente.
          </div>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="flex items-center gap-[13px] px-[15px] py-[13px]">
              <div className={cn("grid h-9 w-9 flex-none place-items-center rounded-lg text-[17px]", IC_CLASS[item.status])}>
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold tracking-tight">
                  {item.what}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {item.service}
                  {item.price ? ` · ${item.price}` : ""}
                </div>
              </div>
              <span
                className={cn(
                  "flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                  STATUS_CLASS[item.status]
                )}
              >
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
              <button
                className="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => openResvModal(item.id)}
                aria-label={`Voir le détail de ${item.what}`}
                title="Voir le détail"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
