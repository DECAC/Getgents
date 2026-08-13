"use client";

import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { WorkspaceCanvas } from "@/components/center/WorkspaceCanvas";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { DocumentViewerModal } from "@/components/shared/DocumentViewerModal";
import type { Espace } from "@/lib/types";
import styles from "./SharedGentShell.module.css";

/**
 * Vue « utilisation simple » d'un gent, ouverte par un lien de partage :
 * pleine page, sans rail de navigation, sans aside et sans lien vers le studio.
 * Le destinataire dispose de l'artefact figé (avec ses boutons d'action) et du
 * module conversationnel — rien d'autre.
 *
 * L'agencement reprend délibérément celui de l'espace : conversation à gauche,
 * espace de travail à droite, et les mêmes déclencheurs sur une page vierge.
 * Une mise en page propre au partage désorientait — le destinataire découvrait
 * une interface que le créateur n'avait jamais vue en Preview.
 */
function SharedGentBody() {
  const { currentEspace, assistantOpen, openAssistant, miniAppMode, documentViewerOpen } = useEspace();
  // Un gent en mode mini-application s'utilise par son tableau de bord : le
  // destinataire n'a pas non plus accès à la conversation.
  const chatAvailable = !miniAppMode;
  // Visionneuse ouverte : la conversation y est déjà rendue, à droite du
  // document (voir DocumentViewerModal) — ne pas la monter deux fois.
  const chatOpen = chatAvailable && assistantOpen && !documentViewerOpen;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.icon}>{currentEspace.icon}</span>
        <div className={styles.headMeta}>
          <h1 className={styles.title}>{currentEspace.gent}</h1>
          <div className={styles.sub}>{currentEspace.name}</div>
        </div>
        {chatAvailable && !assistantOpen && (
          <button type="button" className={styles.chatBtn} onClick={openAssistant}>
            💬 Discuter
          </button>
        )}
      </header>

      <div className={[styles.body, chatOpen ? styles.bodyWithChat : ""].filter(Boolean).join(" ")}>
        {chatOpen && <AssistantPanel />}
        <main className={styles.main}>
          <div className={styles.mainInner}>
            {/* Même canvas que l'espace : il affiche les artefacts produits au
                fil de l'échange et retombe sur les déclencheurs tant qu'il n'y
                en a aucun. Sans lui, un artefact accepté par le destinataire
                était bien enregistré mais ne s'affichait nulle part. */}
            <WorkspaceCanvas espace={currentEspace} />
          </div>
        </main>
      </div>

      <DocumentViewerModal />
      <ArtefactModal />
    </div>
  );
}

export function SharedGentShell({ token, espace }: { token: string; espace: Espace }) {
  return (
    <EspaceProvider initialId="shared" shareToken={token} initialEspaces={{ shared: espace }}>
      <SharedGentBody />
    </EspaceProvider>
  );
}
