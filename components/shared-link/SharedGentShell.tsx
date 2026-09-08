"use client";

import { useEffect, useState } from "react";
import { EspaceProvider, useEspace } from "@/lib/context/EspaceContext";
import { WorkspaceCanvas } from "@/components/center/WorkspaceCanvas";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ArtefactModal } from "@/components/shared/ArtefactModal";
import { DocumentViewerModal } from "@/components/shared/DocumentViewerModal";
import { FileDownloadControl } from "@/components/shared/FileDownloadControl";
import { SignalerIncident } from "@/components/shared/SignalerIncident";
import type { Espace } from "@/lib/types";
import styles from "./SharedGentShell.module.css";

/**
 * Vue « utilisation simple » d'un gent, ouverte par un lien de partage :
 * pleine page, sans rail de navigation, sans aside et sans lien vers le studio.
 * Le destinataire dispose de l'artefact figé (avec ses boutons d'action) et du
 * module conversationnel — rien d'autre.
 *
 * L'agencement reprend délibérément celui de l'espace : conversation à gauche,
 * espace de travail à droite, et les mêmes déclencheurs d'amorce tant que
 * la conversation n'a pas commencé (sur un canevas vierge, ou en bandeau
 * sous l'aperçu d'application).
 * Une mise en page propre au partage désorientait — le destinataire découvrait
 * une interface que le créateur n'avait jamais vue en Preview.
 */
function SharedGentBody({ token }: { token: string }) {
  const { currentEspace, assistantOpen, openAssistant, miniAppMode, documentViewerOpen } = useEspace();

  /**
   * Écran étroit : le canevas est masqué par la feuille de style, et c'est lui
   * qui porte d'ordinaire les questions d'amorce. La conversation doit alors
   * les reprendre — sans quoi le fil s'ouvre vide.
   *
   * Suivi en direct plutôt que lu une fois : une rotation d'appareil fait
   * passer d'un régime à l'autre, et un état figé au montage afficherait les
   * questions en double sur grand écran, ou pas du tout après rotation.
   */
  const [etroit, setEtroit] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 860px)");
    const suivre = () => setEtroit(mq.matches);
    suivre();
    mq.addEventListener("change", suivre);
    return () => mq.removeEventListener("change", suivre);
  }, []);

  // Sur téléphone, la conversation s'ouvre D'EMBLÉE.
  //
  // Le destinataire d'un lien vient pour parler au gent, pas pour lire un
  // écran d'accueil. Sur grand écran l'accueil et la conversation cohabitent ;
  // sur un téléphone ils se disputent la même hauteur, et l'accueil gagnait —
  // il fallait repérer un bouton « Discuter » pour atteindre ce qu'on était
  // venu chercher. Une seule fois : rouvrir de force après une fermeture
  // volontaire empêcherait de revenir à l'accueil.
  useEffect(() => {
    if (miniAppMode) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 860px)").matches) return;
    openAssistant();
    // Volontairement sans `assistantOpen` en dépendance : cet effet ne doit
    // s'exécuter qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniAppMode]);
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
          <div className={styles.sub}>
            <span className={styles.subObjectif}>{currentEspace.name}</span>
            {/* L'attribution vit ICI, et non seulement dans `CenterHeader` :
                cet en-tête est le seul que voient les destinataires d'un lien
                et les visiteurs d'un gent public — c'est-à-dire exactement le
                public à qui cette mention s'adresse. Elle n'apparaît que si
                elle a une valeur : « Propulsé par » suivi du nom du gent, déjà
                écrit au-dessus, ne dirait rien. */}
            {currentEspace.propulsePar?.trim() && (
              <span className={styles.subAuteur}>
                Propulsé par <b>{currentEspace.propulsePar}</b>
              </span>
            )}
          </div>
        </div>
        <div className={styles.headActions}>
          <FileDownloadControl variant="shared" />
          <SignalerIncident token={token} />
          {chatAvailable && !assistantOpen && (
            <button type="button" className={styles.chatBtn} onClick={openAssistant}>
              💬 Discuter
            </button>
          )}
        </div>
      </header>

      <div className={[styles.body, chatOpen ? styles.bodyWithChat : ""].filter(Boolean).join(" ")}>
        {/* `starters` : sur téléphone le canevas est masqué, et c'est lui qui
            porte d'ordinaire les questions d'amorce. Sans cela, le
            destinataire d'un lien arrivait sur un fil vide — rien à lire,
            rien à toucher, aucune idée de ce qu'on peut demander. */}
        {chatOpen && <AssistantPanel starters={etroit} />}
        <main className={styles.main}>
          <div className={styles.mainInner}>
            {/* Même canvas que l'espace : aperçu d'application (avec déclencheurs
                d'amorce tant que la conversation n'a pas commencé) ou ancien
                canevas d'artefacts. Sans lui, un artefact accepté par le
                destinataire était bien enregistré mais ne s'affichait nulle part. */}
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
      <SharedGentBody token={token} />
    </EspaceProvider>
  );
}
