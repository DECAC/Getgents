"use client";

import { useEffect, useCallback } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { Rail } from "@/components/rail/Rail";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { Center } from "@/components/center/Center";
import { Aside } from "@/components/aside/Aside";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { DocumentViewerModal } from "@/components/shared/DocumentViewerModal";
import { ResvModal } from "@/components/shared/ResvModal";
import styles from "./EspaceShell.module.css";

function ShellInner() {
  const { railCollapsed, assistantOpen, asideCollapsed, closeModal, closeAssistant, miniAppMode, documentViewerOpen } =
    useEspace();
  // Mode mini-application : le gent s'utilise par son tableau de bord ; le
  // panneau conversationnel n'est ni rendu ni atteignable.
  // Visionneuse ouverte : c'est ELLE qui héberge la conversation, à droite du
  // document — la monter ici en plus en ferait deux instances, dont une
  // invisible sous la visionneuse.
  const chatOpen = assistantOpen && !miniAppMode && !documentViewerOpen;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // La visionneuse gère son propre Échap (fermer le document, pas la
        // conversation qu'on vient d'y ouvrir).
        if (documentViewerOpen) return;
        closeModal();
        closeAssistant();
      }
    },
    [closeModal, closeAssistant, documentViewerOpen]
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
      <DocumentViewerModal />
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
