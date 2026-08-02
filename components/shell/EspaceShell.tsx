"use client";

import { useEffect, useCallback } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { Rail } from "@/components/rail/Rail";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Center } from "@/components/center/Center";
import { Aside } from "@/components/aside/Aside";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { ResvModal } from "@/components/shared/ResvModal";
import styles from "./EspaceShell.module.css";

function ShellInner() {
  const { railCollapsed, assistantOpen, asideCollapsed, closeModal, closeAssistant, miniAppMode } = useEspace();
  // Mode mini-application : le gent s'utilise par son tableau de bord ; le
  // panneau conversationnel n'est ni rendu ni atteignable.
  const chatOpen = assistantOpen && !miniAppMode;

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
    chatOpen ? styles.assistOpen : "",
    chatOpen && !asideCollapsed ? styles.asideExpanded : "",
    !chatOpen && asideCollapsed ? styles.asideCollapsedOnly : "",
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
        {chatOpen && <AssistantPanel />}
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
