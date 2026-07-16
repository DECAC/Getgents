"use client";

import { useRef, useState, useCallback, Fragment } from "react";
import type { Espace, EspaceTab, Artefact, TimelineStep, ReservationItem, BudgetCategory } from "@/lib/types";
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
  /** Id de l'artefact sous-jacent (modules artefact uniquement), pour l'animation d'arrivée. */
  artefactId?: string;
  render: () => React.ReactNode;
  openModal?: () => void;
  /** Retire le module de l'espace (artefacts uniquement). */
  onRemove?: () => void;
  /** Taille de départ si l'utilisateur n'a pas encore redimensionné. */
  preferredLayout?: ModuleLayout;
}

/** Un onglet affiché dans la vue par thème : soit un thème dynamique (plusieurs modules), soit un module isolé. */
interface ViewTab {
  id: string;
  label: string;
  isTheme: boolean;
  moduleIds: string[];
}

function tabContent(tab: EspaceTab) {
  if (tab.kind === "timeline") return <TimelineTab tab={tab} embedded />;
  if (tab.kind === "resv") return <ReservationsTab tab={tab} />;
  if (tab.kind === "chart") return <BudgetTab tab={tab} />;
  return null;
}

function clampCols(cols: number): number {
  return Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(cols)));
}

function clampHeight(height: number): number {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));
}

/**
 * Bornes resserrées pour les tailles de départ (à distinguer des bornes de
 * redimensionnement MIN/MAX_HEIGHT) : on vise une taille "juste", ni écrasée
 * ni disproportionnée, que l'utilisateur peut ensuite agrandir ou réduire
 * librement via la poignée de redimensionnement.
 */
function clampPreferredHeight(height: number): number {
  return Math.min(420, Math.max(160, Math.round(height)));
}

/** Taille de départ pour un onglet "Itinéraire" : dépend du nombre d'étapes. */
function timelineLayout(steps: TimelineStep[] | undefined): ModuleLayout {
  return { cols: 5, height: clampPreferredHeight(150 + (steps?.length ?? 0) * 58) };
}

/** Taille de départ pour un onglet "Réservations" : dépend du nombre de propositions. */
function reservationsLayout(items: ReservationItem[] | undefined): ModuleLayout {
  return { cols: 4, height: clampPreferredHeight(130 + (items?.length ?? 0) * 92) };
}

/** Taille de départ pour un onglet "Budget" : dépend du nombre de catégories suivies. */
function budgetLayout(categories: BudgetCategory[] | undefined): ModuleLayout {
  return { cols: 3, height: clampPreferredHeight(230 + (categories?.length ?? 0) * 18) };
}

/** La carte reste une vue schématique compacte par défaut, plutôt que pleine largeur. */
function mapLayout(): ModuleLayout {
  return { cols: 5, height: 320 };
}

/** Taille de départ pour un artefact généré en conversation : dépend de sa nature et de son contenu. */
function artefactLayout(a: Artefact): ModuleLayout {
  if (a.checklistItems?.length) {
    return { cols: 3, height: clampPreferredHeight(110 + a.checklistItems.length * 34) };
  }
  if (a.chartData?.length) return { cols: 4, height: 300 };
  if (a.mapPoints?.length) return { cols: 4, height: 300 };

  const plainTextLength = (a.body ?? "").replace(/<[^>]+>/g, " ").trim().length;
  if (a.visual) return { cols: 3, height: clampPreferredHeight(170 + plainTextLength / 5) };
  return { cols: 4, height: clampPreferredHeight(160 + plainTextLength / 4) };
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
  const { openArtefactModal, toggleChecklistItem, userPosition, removeArtefact, recentlyAddedArtefactId } =
    useEspace();

  const [viewMode, setViewMode] = useState<"modules" | "themes">("modules");
  const [activeViewTabId, setActiveViewTabId] = useState<string | null>(null);
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
      preferredLayout:
        tab.kind === "timeline"
          ? timelineLayout(tab.steps)
          : tab.kind === "resv"
            ? reservationsLayout(tab.items)
            : budgetLayout(tab.categories),
      render: () => tabContent(tab),
    })),
    ...(espace.map
      ? [{
          id: "map",
          title: espace.map.title,
          sub: espace.map.hint,
          kind: "map" as const,
          preferredLayout: mapLayout(),
          render: () => <MapTab map={espace.map!} />,
        }]
      : []),
    ...espace.artefacts.map((a): ModuleDef => ({
      id: `artef-${a.id}`,
      title: a.title,
      sub: `${a.type} · ${a.date}`,
      kind: "artefact",
      artefactId: a.id,
      preferredLayout: artefactLayout(a),
      openModal: () => openArtefactModal(a.id),
      onRemove: () => removeArtefact(a.id),
      render: () => (
        <>
          {a.chartData && <MiniBarChart data={a.chartData} />}
          {a.mapPoints && <MapArtefact points={a.mapPoints} userPosition={userPosition} />}
          {a.checklistItems && (
            <ChecklistView items={a.checklistItems} onToggle={(i) => toggleChecklistItem(a.id, i)} />
          )}
          {a.body && <SafeHTMLDoc html={a.body} />}
        </>
      ),
    })),
  ];

  function orderList(list: ModuleDef[]): ModuleDef[] {
    return [
      ...order.map((id) => list.find((m) => m.id === id)).filter((m): m is ModuleDef => !!m),
      ...list.filter((m) => !order.includes(m.id)),
    ];
  }

  const insertAt = useCallback((displayedList: ModuleDef[], targetIndex: number) => {
    const source = dragId.current;
    dragId.current = null;
    setDropIndex(null);
    if (!source || !displayedList.some((m) => m.id === source)) return;

    setOrder((prevOrder) => {
      const ids = displayedList.map((m) => m.id);
      const from = ids.indexOf(source);
      if (from < 0) return prevOrder;
      ids.splice(from, 1);
      const adjusted = from < targetIndex ? targetIndex - 1 : targetIndex;
      ids.splice(Math.max(0, adjusted), 0, source);
      // Le sous-ensemble réordonné passe en tête, le reste garde son ordre relatif précédent.
      const rest = prevOrder.filter((id) => !ids.includes(id));
      return [...ids, ...rest];
    });
  }, []);

  function getLayout(id: string): ModuleLayout {
    if (conf[id]) return conf[id];
    return modules.find((m) => m.id === id)?.preferredLayout ?? { cols: 4, height: 260 };
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

  function collapseAllToList(list: ModuleDef[]) {
    setConf((prev) => {
      setSavedConf(prev);
      const next = { ...prev };
      list.forEach((m) => {
        next[m.id] = { cols: GRID_COLUMNS, height: COMPACT_HEIGHT };
      });
      return next;
    });
  }

  function restoreSizes() {
    setConf(savedConf ?? {});
    setSavedConf(null);
  }

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

  // --- Vue par onglets thématiques ---
  const themeTabs = espace.themeTabs ?? [];
  const groupedModuleIds = new Set(themeTabs.flatMap((t) => t.moduleIds));
  const viewTabs: ViewTab[] = [
    ...modules
      .filter((m) => !groupedModuleIds.has(m.id))
      .map((m): ViewTab => ({ id: m.id, label: m.title, isTheme: false, moduleIds: [m.id] })),
    ...themeTabs.map((t): ViewTab => ({ id: t.id, label: t.label, isTheme: true, moduleIds: t.moduleIds })),
  ];
  const resolvedActiveTabId =
    (activeViewTabId && viewTabs.some((v) => v.id === activeViewTabId) ? activeViewTabId : null) ??
    viewTabs[0]?.id ??
    null;
  const activeViewTab = viewTabs.find((v) => v.id === resolvedActiveTabId) ?? null;

  const visibleList =
    viewMode === "modules"
      ? modules
      : activeViewTab
        ? activeViewTab.moduleIds.map((id) => modules.find((m) => m.id === id)).filter((m): m is ModuleDef => !!m)
        : [];

  const orderedVisible = orderList(visibleList);
  const allList = orderedVisible.length > 0 && orderedVisible.every((m) => getLayout(m.id).height <= COMPACT_HEIGHT);

  function renderGrid(list: ModuleDef[]) {
    return (
      <div className={styles.canvas}>
        {list.map((m, i) => {
          const layout = getLayout(m.id);
          const isCompact = layout.height <= COMPACT_HEIGHT;
          const isJustAdded = !!m.artefactId && m.artefactId === recentlyAddedArtefactId;

          return (
            <Fragment key={m.id}>
              <DropZone
                index={i}
                active={dropIndex === i}
                onDragOver={setDropIndex}
                onDrop={(idx) => insertAt(list, idx)}
                onDragLeave={() => setDropIndex(null)}
              />
              <section
                data-artefact-id={m.artefactId}
                className={[styles.card, isCompact ? styles.cardCompact : "", isJustAdded ? styles.cardJustAdded : ""]
                  .filter(Boolean)
                  .join(" ")}
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
                  insertAt(list, before ? i : i + 1);
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
                    {m.onRemove && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={m.onRemove}
                        title="Retirer de l'espace"
                        aria-label={`Retirer ${m.title} de l'espace`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </span>
                </header>
                {isJustAdded && <span className={styles.newBadge} aria-hidden="true">Nouveau</span>}
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
          index={list.length}
          active={dropIndex === list.length}
          onDragOver={setDropIndex}
          onDrop={(idx) => insertAt(list, idx)}
          onDragLeave={() => setDropIndex(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.viewSwitch} role="tablist" aria-label="Style d'affichage">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "modules"}
            className={[styles.viewSwitchBtn, viewMode === "modules" ? styles.viewSwitchBtnOn : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setViewMode("modules")}
          >
            Vue modules
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "themes"}
            className={[styles.viewSwitchBtn, viewMode === "themes" ? styles.viewSwitchBtnOn : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setViewMode("themes")}
          >
            Vue par thème
          </button>
        </div>
        <span className={styles.toolbarCount}>
          <span key={orderedVisible.length} className={styles.toolbarCountNum}>
            {orderedVisible.length}
          </span>{" "}
          module{orderedVisible.length > 1 ? "s" : ""}
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
            onClick={() => collapseAllToList(orderedVisible)}
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

      {viewMode === "themes" && (
        <div className={styles.viewTabs} role="tablist" aria-label="Onglets thématiques">
          {viewTabs.map((vt) => (
            <div
              key={vt.id}
              className={[styles.viewTab, vt.id === resolvedActiveTabId ? styles.viewTabActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={vt.id === resolvedActiveTabId}
                className={styles.viewTabLabel}
                onClick={() => setActiveViewTabId(vt.id)}
                title={vt.label}
              >
                {vt.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {visibleList.length === 0 ? (
        <p className={styles.emptyText}>Cet onglet ne contient plus aucun module.</p>
      ) : (
        renderGrid(orderedVisible)
      )}
    </div>
  );
}
