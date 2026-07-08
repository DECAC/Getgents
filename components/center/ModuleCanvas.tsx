"use client";

import { useRef, useState, useCallback, Fragment } from "react";
import type { Espace, EspaceTab } from "@/lib/types";
import { useEspace } from "@/lib/context/EspaceContext";
import { TimelineTab } from "./tabs/TimelineTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { MapTab } from "./tabs/MapTab";
import { SafeHTMLDoc } from "@/components/shared/SafeHTML";
import { MiniBarChart } from "@/components/shared/MiniBarChart";
import { ChecklistView } from "@/components/shared/ChecklistView";
import { MapArtefact } from "@/components/shared/MapArtefact";
import styles from "./ModuleCanvas.module.css";

interface ModuleLayout {
  /** Largeur en nombre de colonnes, sur une grille de GRID_COLUMNS colonnes. */
  cols: number;
  /** Hauteur en pixels. */
  height: number;
}

/** Grille plus fine que l'ancien système à 4 presets, pour un redimensionnement continu. */
const GRID_COLUMNS = 8;
const MIN_COLS = 2;
const MAX_COLS = GRID_COLUMNS;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 640;
/** Hauteur en dessous de laquelle le corps de la carte est masqué (vue compacte "liste"). */
const COMPACT_HEIGHT = 56;

interface ModuleDef {
  id: string;
  title: string;
  sub?: string;
  kind: "tab" | "map" | "artefact";
  render: () => React.ReactNode;
  openModal?: () => void;
  /** Taille de départ si l'utilisateur n'a pas encore redimensionné. */
  preferredLayout?: ModuleLayout;
}

function tabContent(tab: EspaceTab) {
  if (tab.kind === "timeline") return <TimelineTab tab={tab} embedded />;
  if (tab.kind === "resv") return <ReservationsTab tab={tab} />;
  if (tab.kind === "chart") return <BudgetTab tab={tab} />;
  return null;
}

function defaultLayout(id: string): ModuleLayout {
  if (id.startsWith("tab-") || id === "map") return { cols: GRID_COLUMNS, height: 480 };
  return { cols: 2, height: 180 };
}

function clampCols(cols: number): number {
  return Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(cols)));
}

function clampHeight(height: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));
}

interface DropZoneProps {
  index: number;
  active: boolean;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragLeave: () => void;
}

function DropZone({ index, active, onDragOver, onDrop, onDragLeave }: DropZoneProps) {
  return (
    <div
      className={[styles.dropZone, active ? styles.dropZoneActive : ""].filter(Boolean).join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver(index);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      aria-hidden="true"
    />
  );
}

export function ModuleCanvas({ espace }: { espace: Espace }) {
  const { openArtefactModal, toggleChecklistItem } = useEspace();

  const [order, setOrder] = useState<string[]>([]);
  const [conf, setConf] = useState<Record<string, ModuleLayout>>({});
  const [savedConf, setSavedConf] = useState<Record<string, ModuleLayout> | null>(null);
  const dragId = useRef<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const resizeState = useRef<{
    id: string;
    startX: number;
    startY: number;
    startCols: number;
    startHeight: number;
    colWidth: number;
  } | null>(null);

  const modules: ModuleDef[] = [
    ...espace.tabs.map((tab): ModuleDef => ({
      id: `tab-${tab.id}`,
      title: tab.name,
      sub: tab.sub,
      kind: "tab",
      render: () => tabContent(tab),
    })),
    ...(espace.map
      ? [{
          id: "map",
          title: espace.map.title,
          sub: espace.map.hint,
          kind: "map" as const,
          render: () => <MapTab map={espace.map!} />,
        }]
      : []),
    ...espace.artefacts.map((a): ModuleDef => ({
      id: `artef-${a.id}`,
      title: a.title,
      sub: `${a.type} · ${a.date}`,
      kind: "artefact",
      preferredLayout: a.mapPoints ? { cols: 4, height: 300 } : undefined,
      openModal: () => openArtefactModal(a.id),
      render: () => (
        <>
          {a.chartData && <MiniBarChart data={a.chartData} />}
          {a.mapPoints && <MapArtefact points={a.mapPoints} />}
          {a.checklistItems && (
            <ChecklistView items={a.checklistItems} onToggle={(i) => toggleChecklistItem(a.id, i)} />
          )}
          {a.body && <SafeHTMLDoc html={a.body} />}
        </>
      ),
    })),
  ];

  const orderedModules = [
    ...order.map((id) => modules.find((m) => m.id === id)).filter((m): m is ModuleDef => !!m),
    ...modules.filter((m) => !order.includes(m.id)),
  ];

  const insertAt = useCallback((targetIndex: number) => {
    const source = dragId.current;
    dragId.current = null;
    setDropIndex(null);
    if (!source) return;

    setOrder(() => {
      const ids = orderedModules.map((m) => m.id);
      const from = ids.indexOf(source);
      if (from < 0) return ids;
      ids.splice(from, 1);
      const adjusted = from < targetIndex ? targetIndex - 1 : targetIndex;
      ids.splice(Math.max(0, adjusted), 0, source);
      return ids;
    });
  }, [orderedModules]);

  function getLayout(id: string): ModuleLayout {
    if (conf[id]) return conf[id];
    const preferred = modules.find((m) => m.id === id)?.preferredLayout;
    return preferred ?? defaultLayout(id);
  }

  function beginResize(e: React.PointerEvent<HTMLSpanElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget.parentElement as HTMLElement | null;
    const layout = getLayout(id);
    const rect = card?.getBoundingClientRect();
    const colWidth = rect && layout.cols > 0 ? rect.width / layout.cols : 120;
    resizeState.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startCols: layout.cols,
      startHeight: layout.height,
      colWidth,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onResizeMove(e: React.PointerEvent<HTMLSpanElement>) {
    const state = resizeState.current;
    if (!state) return;
    const deltaCols = Math.round((e.clientX - state.startX) / state.colWidth);
    const deltaHeight = e.clientY - state.startY;
    setConf((prev) => ({
      ...prev,
      [state.id]: {
        cols: clampCols(state.startCols + deltaCols),
        height: clampHeight(state.startHeight + deltaHeight),
      },
    }));
  }

  function endResize(e: React.PointerEvent<HTMLSpanElement>) {
    if (resizeState.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resizeState.current = null;
  }

  function collapseAllToList() {
    setConf((prev) => {
      setSavedConf(prev);
      const next = { ...prev };
      orderedModules.forEach((m) => {
        next[m.id] = { cols: GRID_COLUMNS, height: COMPACT_HEIGHT };
      });
      return next;
    });
  }

  function restoreSizes() {
    setConf(savedConf ?? {});
    setSavedConf(null);
  }

  const allList =
    orderedModules.length > 0 && orderedModules.every((m) => getLayout(m.id).height <= COMPACT_HEIGHT);

  if (!modules.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>{espace.icon}</div>
        <p className={styles.emptyText}>
          Cet espace ne contient pas encore de module. Ouvrez la conversation — les artefacts
          générés par votre assistant apparaîtront ici, librement organisables.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarCount}>
          {orderedModules.length} module{orderedModules.length > 1 ? "s" : ""}
        </span>
        <div className={styles.toolbarActions}>
          {savedConf && allList && (
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={restoreSizes}
              title="Rétablir les tailles précédentes"
            >
              Rétablir
            </button>
          )}
          <button
            type="button"
            className={[styles.toolbarBtn, styles.toolbarBtnPrimary, allList ? styles.toolbarBtnDisabled : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={collapseAllToList}
            disabled={allList}
            title="Afficher tous les modules en vue liste compacte"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            Tout réduire
          </button>
        </div>
      </div>
      <div className={styles.canvas}>
      {orderedModules.map((m, i) => {
        const layout = getLayout(m.id);
        const isCompact = layout.height <= COMPACT_HEIGHT;

        return (
          <Fragment key={m.id}>
            <DropZone
              index={i}
              active={dropIndex === i}
              onDragOver={setDropIndex}
              onDrop={insertAt}
              onDragLeave={() => setDropIndex(null)}
            />
            <section
              className={[styles.card, isCompact ? styles.cardCompact : ""].filter(Boolean).join(" ")}
              style={{
                gridColumn: `span ${layout.cols}`,
                height: `${layout.height}px`,
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                setDropIndex(before ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const before = e.clientY < rect.top + rect.height / 2;
                insertAt(before ? i : i + 1);
              }}
            >
              <header
                className={styles.cardHead}
                draggable
                onDragStart={(e) => {
                  dragId.current = m.id;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragId.current = null;
                  setDropIndex(null);
                }}
                title="Glisser pour réorganiser"
              >
                <span className={styles.gripIcon} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="6" r="1.6" /><circle cx="16" cy="6" r="1.6" />
                    <circle cx="8" cy="12" r="1.6" /><circle cx="16" cy="12" r="1.6" />
                    <circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" />
                  </svg>
                </span>
                <span className={styles.cardTitleWrap}>
                  <span className={styles.cardTitle}>{m.title}</span>
                  {m.sub && <span className={styles.cardSub}>{m.sub}</span>}
                </span>
                <span className={styles.cardActions}>
                  {m.openModal && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={m.openModal}
                      title="Ouvrir en grand"
                      aria-label="Ouvrir en grand"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <path d="M15 3h6v6M10 14 21 3" />
                      </svg>
                    </button>
                  )}
                </span>
              </header>
              {!isCompact && <div className={styles.cardBody}>{m.render()}</div>}
              <span
                className={styles.resizeHandle}
                onPointerDown={(e) => beginResize(e, m.id)}
                onPointerMove={onResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                title="Glisser pour redimensionner"
                aria-hidden="true"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M8.5 1.5 1.5 8.5" />
                  <path d="M8.5 5 5 8.5" />
                </svg>
              </span>
            </section>
          </Fragment>
        );
      })}
      <DropZone
        index={orderedModules.length}
        active={dropIndex === orderedModules.length}
        onDragOver={setDropIndex}
        onDrop={insertAt}
        onDragLeave={() => setDropIndex(null)}
      />
      </div>
    </div>
  );
}
