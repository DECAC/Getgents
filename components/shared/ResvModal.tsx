"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { ReservationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function ActionCard({ item, onConfirm, onCancel, toolConnected }: {
  item: ReservationItem;
  onConfirm: () => void;
  onCancel: () => void;
  toolConnected: boolean;
}) {
  const { service, category, what, rows, price, status } = item;
  const isAcct = category === "compte_tiers";

  if (status === "cancelled") {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="bg-background px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {service}
        </div>
        <div className="p-3.5">
          <div className="mb-2 text-[14.5px] font-semibold tracking-tight text-muted-foreground">{what}</div>
          <div className="flex items-center gap-1.5 py-0.5 text-[12.5px] font-semibold text-muted-foreground">
            Écarté — rien n&apos;a été envoyé
          </div>
        </div>
      </div>
    );
  }

  if (isAcct && status === "sent") {
    return (
      <div className="overflow-hidden rounded-xl border border-accent-foreground">
        <div className="flex items-center gap-2 bg-accent px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-accent-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {service}
        </div>
        <div className="p-3.5">
          <div className="mb-2 text-[14.5px] font-semibold tracking-tight">{what}</div>
          <Rows rows={rows} price={price} />
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent bg-[#fbf6f9] px-2.5 py-2 text-[12.5px] font-semibold text-accent-foreground">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            Envoyé vers {service} — validez et payez là-bas pour confirmer
          </div>
        </div>
      </div>
    );
  }

  if (isAcct && !toolConnected) {
    return (
      <div className="overflow-hidden rounded-xl border border-secondary-foreground">
        <div className="flex items-center gap-2 bg-secondary px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-secondary-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7M12 17h.01" />
          </svg>
          Proposition — {service}
        </div>
        <div className="p-3.5">
          <div className="mb-2 text-[14.5px] font-semibold tracking-tight">{what}</div>
          <Rows rows={rows} price={price} />
          <div className="mb-3 flex gap-[7px] text-[11.5px] leading-relaxed text-muted-foreground">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px flex-none">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>Connectez votre compte {service} pour pouvoir envoyer cette proposition. Le paiement se fera toujours chez {service}, jamais sur Getgents.</span>
          </div>
          <div className="flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Écarter
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => alert(`Connexion ${service} — non implémentée dans ce commit.`)}
            >
              Connecter {service}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center gap-2 bg-primary-tint px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-primary-hover">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l2 2 4-4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          {service}
        </div>
        <div className="p-3.5">
          <div className="mb-2 text-[14.5px] font-semibold tracking-tight">{what}</div>
          <Rows rows={rows} price={price} />
          <div className="flex items-center gap-1.5 py-0.5 text-[12.5px] font-semibold text-primary-hover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Confirmé par vous · exécuté
          </div>
        </div>
      </div>
    );
  }

  // pending (ecriture or compte_tiers connected)
  const confirmLabel = isAcct
    ? `Envoyer vers ${service}`
    : price ? "Confirmer et payer" : "Confirmer la réservation";

  return (
    <div className="overflow-hidden rounded-xl border border-secondary-foreground">
      <div className="flex items-center gap-2 bg-secondary px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-secondary-foreground">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
        </svg>
        Action engageante — {service}
      </div>
      <div className="p-3.5">
        <div className="mb-2 text-[14.5px] font-semibold tracking-tight">{what}</div>
        <Rows rows={rows} price={price} />
        <div className="mb-3 flex gap-[7px] text-[11.5px] leading-relaxed text-muted-foreground">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px flex-none">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>Rien n&apos;est réservé ni payé tant que vous n&apos;avez pas confirmé. Le gent agit pour votre compte, jamais en autonomie. Getgents ne réserve ni ne paie jamais.</span>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={isAcct ? "accent" : "default"} className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
        {isAcct && toolConnected && (
          <div className="mt-2 flex gap-1.5 text-[11px] leading-tight text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Compte {service} connecté
          </div>
        )}
      </div>
    </div>
  );
}

function Rows({ rows, price }: { rows: [string, string][]; price: string | null }) {
  return (
    <div className="mb-3 flex flex-col gap-[5px]">
      {rows.map(([label, val]) => (
        <div key={label} className="flex justify-between rounded-md bg-background px-2.5 py-1.5 text-[12.5px]">
          <span>{label}</span>
          <b className="font-semibold">{val}</b>
        </div>
      ))}
      {price && (
        <div className="flex justify-between rounded-md bg-background px-2.5 py-1.5 text-[12.5px]">
          <span>Montant indicatif</span>
          <b className="font-semibold">{price}</b>
        </div>
      )}
    </div>
  );
}

export function ResvModal() {
  const { currentEspace, modalResvId, closeModal, confirmReservation, cancelReservation } = useEspace();

  const resvTab = currentEspace.tabs.find((t) => t.kind === "resv");
  const item = modalResvId && resvTab?.items
    ? resvTab.items.find((x) => x.id === modalResvId) ?? null
    : null;

  const toolConnected = item
    ? (currentEspace.tools.find((t) => t.name === item.service)?.connected ?? false)
    : false;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent>
        {item && (
          <>
            <DialogHeader>
              <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[9px] bg-secondary text-[18px]">
                {item.icon}
              </div>
              <div>
                <DialogTitle>{item.what}</DialogTitle>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.service}</div>
              </div>
            </DialogHeader>

            <DialogBody>
              <ActionCard
                item={item}
                toolConnected={toolConnected}
                onConfirm={() => confirmReservation(item.id)}
                onCancel={() => cancelReservation(item.id)}
              />
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
