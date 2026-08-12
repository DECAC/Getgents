"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuilder } from "@/lib/context/BuilderContext";
import { hasCustomName } from "@/lib/builderSnapshot";
import { deleteGentEverywhere } from "@/lib/deleteGent";
import { GENT_ICON_PALETTE } from "@/lib/gentIcons";
import styles from "./BuilderHeader.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  review: "En revue",
  published: "Diffusé",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  draft: styles.dotDraft,
  review: styles.dotReview,
  published: styles.dotPublished,
};

export function BuilderHeader() {
  const { currentDraft, updateName, updateObjective, updateIcon, syncWorkingVersion } = useBuilder();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!iconMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!iconRef.current?.contains(e.target as Node)) setIconMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIconMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [iconMenuOpen]);

  // Preview part TOUJOURS de la configuration à l'instant : on écrit la
  // version de travail avant d'ouvrir l'onglet, sinon l'espace rechargerait
  // la version précédente et les nouveautés seraient intestables.
  function handlePreview() {
    syncWorkingVersion();
    window.open(`/espace/${currentDraft.id}`, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    const name = currentDraft.name || "ce gent";
    if (
      !window.confirm(
        `Supprimer définitivement « ${name} » ? Cette action est irréversible : le brouillon, la version diffusée et les liens de partage seront effacés.`
      )
    ) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    const result = await deleteGentEverywhere(currentDraft.id);
    if (!result.ok) {
      setDeleteError(`Suppression incomplète : ${result.error ?? "erreur inconnue"}`);
      setDeleting(false);
      return;
    }
    router.push("/builder");
  }

  const nameOk = hasCustomName(currentDraft);

  return (
    <header className={styles.head}>
      <div className={styles.top}>
        <div className={styles.icWrap} ref={iconRef}>
          <button
            type="button"
            className={styles.ic}
            onClick={() => setIconMenuOpen((v) => !v)}
            aria-expanded={iconMenuOpen}
            aria-haspopup="menu"
            aria-label={`Emblème du gent : ${currentDraft.icon}. Cliquer pour changer.`}
            title="Changer l'emblème du gent"
          >
            {currentDraft.icon}
          </button>
          {iconMenuOpen && (
            <div className={styles.iconMenu} role="menu" aria-label="Choisir un emblème">
              {GENT_ICON_PALETTE.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  role="menuitemradio"
                  aria-checked={icon === currentDraft.icon}
                  className={[styles.iconChoice, icon === currentDraft.icon ? styles.iconChoiceOn : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    updateIcon(icon);
                    setIconMenuOpen(false);
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.meta}>
          <label className={styles.nameLabel} htmlFor="gent-name">
            Nom du gent
          </label>
          <div className={styles.nameWrap}>
            <input
              id="gent-name"
              className={styles.nameInput}
              value={currentDraft.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="Ex. Assistant au pair, Coach voyage…"
              aria-label="Nom du gent"
              spellCheck={false}
            />
            <span className={styles.statusInline}>
              <span className={[styles.statusDot, STATUS_DOT_CLASS[currentDraft.status]].join(" ")} />
              {STATUS_LABEL[currentDraft.status]}
            </span>
            <span className={styles.nameEditHint} aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
          </div>
          {!nameOk && <div className={styles.nameWarning}>Donnez un nom à ce gent pour pouvoir le diffuser</div>}
          <input
            className={styles.objectiveInput}
            value={currentDraft.objective}
            onChange={(e) => updateObjective(e.target.value)}
            placeholder="Objectif premier de ce gent, en une phrase…"
            aria-label="Objectif du gent"
          />
        </div>
        <button
          type="button"
          className={styles.viewLiveLink}
          onClick={handlePreview}
          disabled={!nameOk}
          title={
            nameOk
              ? "Ouvre le gent tel qu'il est configuré à l'instant, modifications comprises"
              : "Donnez un nom au gent avant de le prévisualiser"
          }
        >
          Preview
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6M10 14 21 3" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Supprimer ce gent (brouillon, publication et liens de partage)"
        >
          {deleting ? "Suppression…" : "Supprimer"}
        </button>
      </div>

      {deleteError && <div className={styles.deleteError}>{deleteError}</div>}
    </header>
  );
}
