"use client";

import { useRef, useEffect } from "react";
import { useEspace } from "@/lib/context/EspaceContext";
import { Textarea } from "@/components/ui/textarea";

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
      className="relative flex min-h-0 flex-col overflow-y-auto border-l border-border bg-card"
      aria-label="Mémoire et fichiers"
      id="aside"
    >
      {/* Icon rail (visible when the aside is collapsed) */}
      {asideCollapsed && (
        <div className="flex h-full flex-col items-center gap-2 py-4">
          <button
            className="mb-1 grid h-[30px] w-[30px] place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={toggleAsideCollapsed}
            title="Déployer Mémoire et fichiers"
            aria-label="Déployer Mémoire et fichiers"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-border bg-card text-muted-foreground hover:border-primary hover:bg-background hover:text-foreground"
            onClick={toggleAsideCollapsed}
            title="Ouvrir Mémoire"
            aria-label="Ouvrir Mémoire"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3M9 3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9" />
            </svg>
          </button>
          <button
            className="relative grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-border bg-card text-muted-foreground hover:border-primary hover:bg-background hover:text-foreground"
            onClick={toggleAsideCollapsed}
            title="Ouvrir Fichiers"
            aria-label="Ouvrir Fichiers"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.5V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
              <path d="M17 13v6M14 16h6" />
            </svg>
            {files.length > 0 && (
              <span className="absolute -right-[3px] -top-[3px] h-[9px] w-[9px] rounded-full border-[1.5px] border-card bg-secondary-foreground" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {/* Full aside content */}
      {!asideCollapsed && (
        <>
          <div className="flex flex-shrink-0 items-center justify-between px-[18px] pb-0 pt-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              Mémoire et fichiers
            </span>
            <button
              className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[7px] text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={toggleAsideCollapsed}
              title="Réduire la colonne"
              aria-label="Réduire la colonne"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <section className="p-[18px]">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="m-0 flex items-center gap-2 font-display text-[14.5px] font-bold tracking-tight">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2">
                  <path d="M9 3a3 3 0 0 0-3 3v12a3 3 0 0 0 9 0V6a3 3 0 0 0-3-3z" />
                  <path d="M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9" />
                </svg>
                Mémoire
              </h3>
            </div>
            <p className="m-0 mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Le résumé que votre assistant tient à jour : l&apos;historique et vos décisions au
              fil des échanges. Modifiable.
            </p>
            <Textarea
              ref={memRef}
              className="min-h-[120px] overflow-hidden"
              value={currentEspace.memory}
              onChange={handleMemoryChange}
              aria-label="Mémoire de l'espace"
            />
            <div className="mt-2.5 flex items-center gap-1.5 px-0.5 text-[11px] leading-tight text-muted-foreground">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                <path d="M12 7v5l3 2" />
              </svg>
              Conservé tant que l&apos;espace est ouvert.
            </div>
          </section>

          <section className="border-t border-muted p-[18px]">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="m-0 flex items-center gap-2 font-display text-[14.5px] font-bold tracking-tight">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                  <path d="M21 12.5V7a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
                  <path d="M17 13v6M14 16h6" />
                </svg>
                Fichiers
              </h3>
              {files.length > 0 && <span className="text-[11px] font-medium text-faint">{files.length}</span>}
            </div>
            <p className="m-0 mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
              Ce que vous avez téléversé pour cette conversation — billets, documents, photos.
            </p>

            <div className="mb-2.5 flex flex-col gap-2.5">
              {files.length === 0 ? (
                <div className="rounded-lg bg-background p-4 text-center text-[12.5px] leading-relaxed text-muted-foreground">
                  Aucun fichier pour l&apos;instant.
                  <br />
                  Ajoutez un document, une photo ou un billet à transmettre à l&apos;assistant.
                </div>
              ) : (
                files.map((f) => (
                  <div key={f.id} className="flex items-start gap-[11px] rounded-lg border border-border bg-card p-3">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-secondary text-secondary-foreground [&_svg]:h-[17px] [&_svg]:w-[17px]">
                      {FILE_ICON}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-tight tracking-tight">
                        {f.name}
                      </span>
                      <span className="mt-[3px] text-[11px] text-muted-foreground">
                        {f.size} · {f.date}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              className="flex w-full items-center justify-center gap-[7px] rounded-lg border border-dashed border-border bg-transparent px-3 py-2.5 text-[12.5px] font-semibold text-primary-hover hover:border-primary hover:bg-primary-tint"
              onClick={() => alert("Maquette : ouvrirait un sélecteur de fichier.")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12M7 8l5-5 5 5" />
                <path d="M5 21h14" />
              </svg>
              Ajouter un fichier
            </button>
          </section>
        </>
      )}
    </aside>
  );
}
