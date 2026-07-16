"use client";

import { useEffect, useCallback } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { Rail } from "@/components/rail/Rail";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Center } from "@/components/center/Center";
import { Aside } from "@/components/aside/Aside";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { ResvModal } from "@/components/shared/ResvModal";
import { ArtefactFlight } from "@/components/shared/ArtefactFlight";
import styles from "./EspaceShell.module.css";

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

  const shellClass = [
    styles.shell,
    railCollapsed ? styles.collapsed : "",
    assistantOpen ? styles.assistOpen : "",
    assistantOpen && !asideCollapsed ? styles.asideExpanded : "",
    !assistantOpen && asideCollapsed ? styles.asideCollapsedOnly : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <div className={shellClass} id="shell">
        <Rail />
        {assistantOpen && <AssistantPanel />}
        <Center />
        <Aside />
      </div>
      <ArtefactModal />
      <ResvModal />
      <ArtefactFlight />
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
