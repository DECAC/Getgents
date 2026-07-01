"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTMLDoc } from "./SafeHTML";
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function VisualGrid() {
  return (
    <div className="mb-4 grid grid-cols-[1.4fr_1fr_1fr] grid-rows-[90px_90px] gap-1.5 [&_>_div:first-child]:row-span-2 [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:rounded-lg">
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
  const { currentEspace, modalArtefactId, closeModal } = useEspace();

  const artefact = modalArtefactId
    ? currentEspace.artefacts.find((a) => a.id === modalArtefactId) ?? null
    : null;

  return (
    <Dialog open={!!artefact} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent>
        {artefact && (
          <>
            <DialogHeader>
              <div
                className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[9px] bg-secondary text-secondary-foreground [&_svg]:h-5 [&_svg]:w-5"
                dangerouslySetInnerHTML={{ __html: artefact.icon }}
              />
              <div>
                <DialogTitle>{artefact.title}</DialogTitle>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {artefact.type} · {artefact.date}
                </div>
              </div>
            </DialogHeader>

            <DialogBody>
              {artefact.visual && <VisualGrid />}
              <SafeHTMLDoc html={artefact.body} />
            </DialogBody>

            <DialogFooter>
              <span className="mr-auto flex items-center gap-1.5 text-[11px] text-faint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" />
                </svg>
                Généré par Getgents · gabarit standard
              </span>
              <Button variant="outline" onClick={() => alert("Export PDF — non implémenté dans ce commit.")}>
                Exporter en PDF
              </Button>
              <Button onClick={() => alert("Mise à jour — non implémentée dans ce commit.")}>Mettre à jour</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
