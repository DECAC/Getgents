"use client";

import { useEffect, useRef, useState } from "react";
import { copyReport, downloadReport } from "@/lib/testReport";
import styles from "./ReportMenu.module.css";

interface Props {
  /** Construit le markdown au moment du clic (état le plus frais). */
  getMarkdown: () => string;
  baseName: string;
}

/** Bouton « 📄 Rapport » avec deux options : télécharger (.md) ou copier. */
export function ReportMenu({ getMarkdown, baseName }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function handleCopy() {
    const ok = await copyReport(getMarkdown());
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2000);
    if (ok) setOpen(false);
  }

  return (
    <span className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        title="Rapport de test de cette session (configuration + transcript, markdown)"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {copied ? "✓ Copié" : "📄 Rapport"}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              downloadReport(getMarkdown(), baseName);
              setOpen(false);
            }}
          >
            ⬇ Télécharger (.md)
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleCopy}>
            📋 Copier dans le presse-papiers
          </button>
        </div>
      )}
    </span>
  );
}
