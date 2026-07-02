"use client";

import { useRef, useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { ToolsTab } from "@/components/center/tabs/ToolsTab";
import styles from "./Aside.module.css";

const FILE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 3v5h5" />
    <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
  </svg>
);

export function Aside() {
  const { currentEspace, asideCollapsed, toggleAsideCollapsed, updateMemory } = useEspace();
  const memRef = useRef<HTMLTextAreaElement>(null);
  const files = currentEspace.files;
  const tools = currentEspace.tools;

  // Auto-size textarea when espace changes
  useEffect(() => {
    const el = memRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [currentEspace.memory]);

  function handleMemoryChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    updateMemory(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }

  return (
    <aside
      className={[styles.aside, asideCollapsed ? styles.collapsed : ""].filter(Boolean).join(" ")}
      aria-label="Mémoire, fichiers et tools"
      id="aside"
    >
      {/* Icon rail (visible when the aside is collapsed) */}
      {asideCollapsed && (
        <div className={styles.asideRail}>
          <button
            className={styles.railToggleBtn}
            onClick={toggleAsideCollapsed}
            title="Déployer Mémoire et fichiers"
            aria-label="Déployer Mémoire et fichiers"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            className={styles.railBtn}
            onClick={toggleAsideCollapsed}
            title="Ouvrir Mémoire"
            aria-label="Ouvrir Mémoire"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3M9 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9" />
            </svg>
          </button>
          <button
            className={styles.railBtn}
            onClick={toggleAsideCollapsed}
            title="Ouvrir Fichiers"
            aria-label="Ouvrir Fichiers"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.5V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
              <path d="M17 13v6M14 16h6" />
            </svg>
            {files.length > 0 && (
              <span className={styles.railDot} aria-hidden="true" />
            )}
          </button>
          {tools.length > 0 && (
            <button
              className={styles.railBtn}
              onClick={toggleAsideCollapsed}
              title="Ouvrir Tools"
              aria-label="Ouvrir Tools"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Full aside content */}
      {!asideCollapsed && (
        <>
          <div className={styles.asideHead}>
            <span className={styles.asideHeadLabel}>Mémoire et fichiers</span>
            <button
              className={styles.collapseBtn}
              onClick={toggleAsideCollapsed}
              title="Réduire la colonne"
              aria-label="Réduire la colonne"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <section className={styles.section}>
            <div className={styles.shead}>
              <h3 className={styles.sTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2">
                  <path d="M9 3a3 3 0 0 0-3 3v12a3 3 0 0 0 9 0V6a3 3 0 0 0-3-3z" />
                  <path d="M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9" />
                </svg>
                Mémoire
              </h3>
            </div>
            <p className={styles.shelp}>
              Le résumé que votre assistant tient à jour : l&apos;historique et vos décisions au
              fil des échanges. Modifiable.
            </p>
            <textarea
              ref={memRef}
              className={styles.memory}
              value={currentEspace.memory}
              onChange={handleMemoryChange}
              aria-label="Mémoire de l'espace"
            />
            <div className={styles.memFoot}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                <path d="M12 7v5l3 2" />
              </svg>
              Conservé tant que l&apos;espace est ouvert.
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.shead}>
              <h3 className={styles.sTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                  <path d="M21 12.5V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
                  <path d="M17 13v6M14 16h6" />
                </svg>
                Fichiers
              </h3>
              {files.length > 0 && (
                <span className={styles.cnt}>{files.length}</span>
              )}
            </div>
            <p className={styles.shelp}>
              Ce que vous avez téléversé pour cette conversation — billets, documents, photos.
            </p>

            <div className={styles.artlist}>
              {files.length === 0 ? (
                <div className={styles.artEmpty}>
                  Aucun fichier pour l&apos;instant.
                  <br />
                  Ajoutez un document, une photo ou un billet à transmettre à l&apos;assistant.
                </div>
              ) : (
                files.map((f) => (
                  <div key={f.id} className={styles.artcard}>
                    <span className={styles.artTi}>{FILE_ICON}</span>
                    <span className={styles.artInfo}>
                      <span className={styles.artTitle}>{f.name}</span>
                      <span className={styles.artMeta}>
                        {f.size} · {f.date}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              className={styles.uploadBtn}
              onClick={() => alert("Maquette : ouvrirait un sélecteur de fichier.")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </svg>
              Ajouter un fichier
            </button>
          </section>

          {tools.length > 0 && (
            <section className={styles.section} id="aside-tools">
              <div className={styles.shead}>
                <h3 className={styles.sTitle}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--plum)" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
                  </svg>
                  Tools
                </h3>
                <span className={styles.cnt}>{tools.length}</span>
              </div>
              <p className={styles.shelp}>
                Intégrations et connecteurs disponibles pour ce gent — lecture seule, écriture ou compte tiers.
              </p>
              <ToolsTab tools={tools} variant="aside" />
            </section>
          )}
        </>
      )}
    </aside>
  );
}
