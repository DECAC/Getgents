"use client";

import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { PinnedArtefactPanel } from "@/components/center/PinnedArtefactPanel";
import { StarterBubbles } from "@/components/center/StarterBubbles";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
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
  const { currentEspace, assistantOpen, openAssistant, miniAppMode } = useEspace();
  const pinned = currentEspace.pinnedArtefact;
  // Un gent en mode mini-application s'utilise par son tableau de bord : le
  // destinataire n'a pas non plus accès à la conversation.
  const chatAvailable = !miniAppMode;
  const chatOpen = chatAvailable && assistantOpen;

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
            {pinned?.enabled ? (
              <PinnedArtefactPanel pinned={pinned} />
            ) : (
              <StarterBubbles espace={currentEspace} />
            )}
          </div>
        </main>
      </div>
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
