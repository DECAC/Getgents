"use client";

import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { PinnedArtefactPanel } from "@/components/center/PinnedArtefactPanel";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import type { Espace } from "@/lib/types";
import styles from "./SharedGentShell.module.css";

/**
 * Vue « utilisation simple » d'un gent, ouverte par un lien de partage :
 * pleine page, sans rail de navigation, sans aside et sans lien vers le studio.
 * Le destinataire dispose de l'artefact figé (avec ses boutons d'action) et du
 * module conversationnel — rien d'autre.
 */
function SharedGentBody() {
  const { currentEspace, assistantOpen, openAssistant, miniAppMode } = useEspace();
  const pinned = currentEspace.pinnedArtefact;
  // Un gent en mode mini-application s'utilise par son tableau de bord : le
  // destinataire n'a pas non plus accès à la conversation.
  const chatAvailable = !miniAppMode;

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

      <main className={styles.main}>
        {pinned?.enabled ? (
          <PinnedArtefactPanel pinned={pinned} />
        ) : (
          <div className={styles.empty}>
            <p>Ce gent s&apos;utilise en conversation — ouvrez le chat pour commencer.</p>
            <button type="button" className={styles.chatBtn} onClick={openAssistant}>
              💬 Discuter
            </button>
          </div>
        )}
      </main>

      {chatAvailable && assistantOpen && <AssistantPanel />}
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
