"use client";

import { useEffect, useCallback } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { Rail } from "@/components/rail/Rail";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Center } from "@/components/center/Center";
import { Aside } from "@/components/aside/Aside";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { ResvModal } from "@/components/shared/ResvModal";

function ShellInner() {
  const { railCollapsed, assistantOpen, asideCollapsed, closeModal, closeAssistant } = useEspace();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        closeAssistant();
      }
    },
    [closeModal, closeAssistant]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const railCol = railCollapsed ? "var(--rail-min)" : "var(--rail)";
  const asideCol = asideCollapsed ? "var(--aside-collapsed)" : "var(--aside)";
  const gridTemplateColumns = assistantOpen
    ? `${railCol} var(--assist) 1fr ${asideCol}`
    : `${railCol} 1fr ${asideCol}`;

  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <div
        className="grid h-screen overflow-hidden transition-[grid-template-columns] duration-200 max-[860px]:!grid-cols-1"
        style={{ gridTemplateColumns }}
        id="shell"
      >
        <Rail />
        {assistantOpen && <AssistantPanel />}
        <Center />
        <Aside />
      </div>
      <ArtefactModal />
      <ResvModal />
    </>
  );
}

export function EspaceShell({ initialId }: { initialId: string }) {
  return (
    <EspaceProvider initialId={initialId}>
      <ShellInner />
    </EspaceProvider>
  );
}
