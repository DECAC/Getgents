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

type ModuleSize = "list" | "small" | "medium" | "large";

const SIZE_ORDER: ModuleSize[] = ["list", "small", "medium", "large"];

const SIZE_LAYOUT: Record<ModuleSize, { cols: number; height: number }> = {
  list: { cols: 4, height: 44 },
  small: { cols: 1, height: 180 },
  medium: { cols: 2, height: 300 },
  large: { cols: 4, height: 480 },
};

const SIZE_LABEL: Record<ModuleSize, string> = {
  list: "Liste",
  small: "Petit",
  medium: "Moyen",
  large: "Très grand",
};

interface ModuleDef {
  id: string;
  title: string;
  sub?: string;
  kind: "tab" | "map" | "artefact";
  render: () => React.ReactNode;
  openModal?: () => void;
  /** Taille de départ si l'utilisateur n'a pas encore redimensionné. */
  preferredSize?: ModuleSize;
}

interface ModuleConf {
  size: ModuleSize;
}

function tabContent(tab: EspaceTab) {
  if (tab.kind === "timeline") return <TimelineTab tab={tab} embedded />;
  if (tab.kind === "resv") return <ReservationsTab tab={tab} />;
  if (tab.kind === "chart") return <BudgetTab tab={tab} />;
  return null;
}

function defaultSize(id: string): ModuleSize {
  if (id.startsWith("tab-") || id === "map") return "large";
  return "small";
}

function nextSize(current: ModuleSize): ModuleSize {
  const i = SIZE_ORDER.indexOf(current);
  return SIZE_ORDER[(i + 1) % SIZE_ORDER.length];
}

function SizeIcon({ size }: { size: ModuleSize }) {
  if (size === "list") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (size === "small") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="8" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (size === "medium") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="6" width="18" height="12" rx="2" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="18" rx="2" />
    </svg>
  );
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
  const [conf, setConf] = useState<Record<string, ModuleConf>>({});
  const [savedConf, setSavedConf] = useState<Record<string, ModuleConf> | null>(null);
  const dragId = useRef<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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
      preferredSize: a.mapPoints ? "medium" : undefined,
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

  function cycleSize(id: string) {
    const current = getSize(id);
    setConf((prev) => ({ ...prev, [id]: { size: nextSize(current) } }));
  }

  function getSize(id: string): ModuleSize {
    if (conf[id]?.size) return conf[id].size;
    const preferred = modules.find((m) => m.id === id)?.preferredSize;
    return preferred ?? defaultSize(id);
  }

  function collapseAllToList() {
    setConf((prev) => {
      setSavedConf(prev);
      const next = { ...prev };
      orderedModules.forEach((m) => {
        next[m.id] = { size: "list" };
      });
      return next;
    });
  }

  function restoreSizes() {
    setConf(savedConf ?? {});
    setSavedConf(null);
  }

  const allList =
    orderedModules.length > 0 && orderedModules.every((m) => getSize(m.id) === "list");

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
        const size = getSize(m.id);
        const layout = SIZE_LAYOUT[size];
        const isList = size === "list";

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
              className={[styles.card, isList ? styles.cardList : ""].filter(Boolean).join(" ")}
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
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => cycleSize(m.id)}
                    title={`Taille : ${SIZE_LABEL[size]} — cliquer pour changer`}
                    aria-label={`Taille actuelle ${SIZE_LABEL[size]}, cliquer pour agrandir`}
                  >
                    <SizeIcon size={size} />
                  </button>
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
              {!isList && <div className={styles.cardBody}>{m.render()}</div>}
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
