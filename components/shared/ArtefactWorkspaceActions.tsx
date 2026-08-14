"use client";

import { useState } from "react";
import type { Artefact } from "@/lib/types";
import { useEspace } from "@/lib/context/EspaceContext";
import { ARTEFACT_KIND_META, inferArtefactKind, type WorkspaceArtefactKind } from "@/lib/artefactKind";
import { convertibleKinds } from "@/lib/artefactConversion";
import { ShareArtefactDialog } from "./ShareArtefactDialog";
import styles from "./ArtefactWorkspaceActions.module.css";

export function ArtefactWorkspaceActions({
  artefact,
  showEnlarge = true,
  labeled = false,
}: {
  artefact: Artefact;
  showEnlarge?: boolean;
  /** Boutons avec libellé (modale / tuile aperçu) plutôt que seules icônes. */
  labeled?: boolean;
}) {
  const { openArtefactModal, changeArtefactKind } = useEspace();
  const [shareOpen, setShareOpen] = useState(false);
  const kind = inferArtefactKind(artefact);
  // Seuls les types réellement atteignables depuis ce contenu : proposer
  // « Carte » à un rapport sans coordonnées ne pouvait mener qu'à un
  // changement d'étiquette sans effet.
  const kinds = Array.from(new Set([kind, ...convertibleKinds(artefact)]));

  return (
    <>
      <span className={styles.wrap} onClick={(e) => e.stopPropagation()}>
        {showEnlarge ? (
          <button
            type="button"
            className={labeled ? styles.btn : styles.iconBtn}
            onClick={() => openArtefactModal(artefact.id)}
            title="Agrandir"
            aria-label="Agrandir"
          >
            <ExpandIcon />
            {labeled ? "Agrandir" : null}
          </button>
        ) : null}
        <label className={styles.typeWrap} title="Modifier le type d'artefact">
          {labeled ? <span className={styles.typeLabel}>Type</span> : null}
          <select
            className={styles.select}
            value={kind}
            aria-label="Modifier le type d'artefact"
            onChange={(e) => changeArtefactKind(artefact.id, e.target.value as WorkspaceArtefactKind)}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {ARTEFACT_KIND_META[k].type}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={labeled ? styles.btn : styles.iconBtn}
          onClick={() => setShareOpen(true)}
          title="Partager"
          aria-label="Partager"
        >
          <ShareIcon />
          {labeled ? "Partager" : null}
        </button>
      </span>
      {shareOpen ? <ShareArtefactDialog artefact={artefact} onClose={() => setShareOpen(false)} /> : null}
    </>
  );
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
    </svg>
  );
}
