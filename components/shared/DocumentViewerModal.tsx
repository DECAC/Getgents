"use client";

import { useEffect, useState } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { FileDownloadControl } from "@/components/shared/FileDownloadControl";
import styles from "./DocumentViewerModal.module.css";

/**
 * Lecture immersive d'un document : sommaire à gauche (signets du PDF ou
 * titres détectés), page courante au centre, conversation à droite quand le
 * lecteur l'ouvre. Composant à part plutôt qu'une branche de plus dans
 * ArtefactModal — la mise en page (pleine fenêtre, trois colonnes) n'a rien à
 * voir avec la carte centrée des autres artefacts.
 *
 * Le panneau conversationnel est à DROITE et non à gauche comme ailleurs :
 * le sommaire occupe déjà la gauche, et c'est lui qui structure la lecture.
 * Il coexiste avec la page — poser une question ne remplace jamais le
 * document, et un artefact généré pendant l'échange se superpose sans faire
 * perdre sa page au lecteur (voir openArtefactModal dans EspaceContext).
 */
export function DocumentViewerModal() {
  const {
    currentEspace,
    viewerArtefactId,
    closeDocumentViewer,
    modalArtefactId,
    modalResvId,
    pendingArtefactVerdict,
    assistantOpen,
    openAssistant,
    closeAssistant,
    removeArtefact,
  } = useEspace();

  const artefact = viewerArtefactId
    ? currentEspace.artefacts.find((a) => a.id === viewerArtefactId) ?? null
    : null;
  const [page, setPage] = useState(0);

  // Chaque document repart de sa première page : rouvrir un autre document
  // en gardant l'index du précédent affichait une page arbitraire.
  useEffect(() => {
    setPage(0);
  }, [viewerArtefactId]);

  const open = !!artefact?.document;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const pageCount = artefact?.document?.pages.length ?? 0;
  // Une carte ouverte PAR-DESSUS la visionneuse (artefact ou réservation)
  // capte Échap et les flèches : sans ça, refermer un rapport généré pendant
  // la lecture refermait aussi le document en arrière-plan.
  const covered = !!modalArtefactId || !!modalResvId || !!pendingArtefactVerdict;

  useEffect(() => {
    if (!open || covered) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeDocumentViewer();
      else if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, pageCount - 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, covered, closeDocumentViewer, pageCount]);

  if (!artefact?.document) return null;
  const doc = artefact.document;

  // Document fixé par le créateur (type de gent « visionneuse ») : pas de
  // bouton pour le retirer, contrairement à un document ouvert à l'usage.
  const locked = artefact.id === "visionneuse-doc";
  const activeTocId = [...doc.toc].reverse().find((t) => t.page <= page)?.id;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={doc.sourceName}>
      <div className={[styles.frame, assistantOpen ? styles.frameWithChat : ""].filter(Boolean).join(" ")}>
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">📖</span>
          <div className={styles.headText}>
            <div className={styles.headTitle}>{doc.sourceName}</div>
            <div className={styles.headMeta}>
              {doc.pageCount} page{doc.pageCount > 1 ? "s" : ""}
              {doc.truncated ? " · document tronqué" : ""}
            </div>
          </div>
          <div className={styles.headActions}>
            <FileDownloadControl variant="viewer" />
            <button
              type="button"
              className={[styles.navBtn, assistantOpen ? styles.navBtnOn : ""].filter(Boolean).join(" ")}
              onClick={() => (assistantOpen ? closeAssistant() : openAssistant())}
              title={assistantOpen ? "Masquer la conversation" : "Poser une question sur ce document"}
              aria-label={assistantOpen ? "Masquer la conversation" : "Poser une question sur ce document"}
              aria-pressed={assistantOpen}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.6A8.4 8.4 0 1 1 21 11.5z" />
              </svg>
            </button>
            {!locked && (
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => {
                  removeArtefact(artefact.id);
                  closeDocumentViewer();
                }}
                title="Retirer ce document de l'espace"
                aria-label="Retirer ce document de l'espace"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={closeDocumentViewer} aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>

        {doc.truncated && (
          <div className={styles.truncatedNote}>
            Ce document dépasse la taille prise en charge par la visionneuse — seules les {doc.pageCount} premières
            pages sont affichées.
          </div>
        )}

        <nav className={styles.toc} aria-label="Sommaire du document">
          {doc.toc.length === 0 ? (
            <div className={styles.tocEmpty}>
              Aucun sommaire détecté dans ce document — naviguez page par page avec les flèches ci-dessous.
            </div>
          ) : (
            doc.toc.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={[styles.tocItem, entry.id === activeTocId ? styles.tocItemOn : ""].filter(Boolean).join(" ")}
                style={{ paddingLeft: 10 + (entry.level - 1) * 14 }}
                onClick={() => setPage(entry.page)}
              >
                {entry.title}
              </button>
            ))
          )}
        </nav>

        <div className={styles.pageArea}>
          <div className={styles.pageScroll}>
            <div className={styles.pageText}>{doc.pages[page]}</div>
          </div>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              aria-label="Page précédente"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span className={styles.navIndicator}>
              Page {page + 1} / {doc.pageCount}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setPage((p) => Math.min(p + 1, doc.pages.length - 1))}
              disabled={page >= doc.pages.length - 1}
              aria-label="Page suivante"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {assistantOpen && (
          <div className={styles.chatCol}>
            <AssistantPanel embedded />
          </div>
        )}
      </div>
    </div>
  );
}
