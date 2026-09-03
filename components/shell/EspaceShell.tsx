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
import { CollabPreviewShell } from "@/components/collab/CollabPreviewShell";
import styles from "./EspaceShell.module.css";

/** Espace classique (conversationnel / mini-app / visionneuse). */
function ClassicShellInner() {
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

function ShellInner() {
  const { currentEspace, storageReady } = useEspace();

  // Attendre l'hydratation (localStorage / serveur) : sinon on affiche un
  // instant le shell classique sur le FALLBACK, et Preview Event Manager
  // paraît « cassé » (chat vide au lieu du gabarit salon).
  if (!storageReady || !currentEspace) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          color: "var(--muted, #667)",
          fontSize: 14,
        }}
      >
        Ouverture de l&apos;aperçu…
      </div>
    );
  }

  // Event Manager / collaboratif : Preview doit montrer le gabarit du salon,
  // pas l'espace conversationnel classique (sinon le créateur ne voit rien
  // de ce que les participants verront via le lien).
  if (currentEspace.collab?.enabled) {
    return <CollabPreviewShell espace={currentEspace} />;
  }
  return <ClassicShellInner />;
}

export function EspaceShell({ initialId }: { initialId: string }) {
  return (
    <EspaceProvider initialId={initialId}>
      <ShellInner />
    </EspaceProvider>
  );
}
