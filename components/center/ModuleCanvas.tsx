"use client";

import { useRef, useState, useCallback } from "react";
import type { Espace, EspaceTab } from "@/lib/types";
import { useEspace } from "@/lib/context/EspaceContext";
import { TimelineTab } from "./tabs/TimelineTab";
import { ReservationsTab } from "./tabs/ReservationsTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { MapTab } from "./tabs/MapTab";
import { SafeHTMLDoc } from "@/components/shared/SafeHTML";
import { MiniBarChart } from "@/components/shared/MiniBarChart";
import { ChecklistView } from "@/components/shared/ChecklistView";
import styles from "./ModuleCanvas.module.css";

interface ModuleDef {
  id: string;
  title: string;
  sub?: string;
  kind: "tab" | "map" | "artefact";
  render: () => React.ReactNode;
  openModal?: () => void;
}

interface ModuleConf {
  span: 1 | 2;
  height?: number;
}

function tabContent(tab: EspaceTab) {
  if (tab.kind === "timeline") return <TimelineTab tab={tab} embedded />;
  if (tab.kind === "resv") return <ReservationsTab tab={tab} />;
  if (tab.kind === "chart") return <BudgetTab tab={tab} />;
  return null;
}

export function ModuleCanvas({ espace }: { espace: Espace }) {
  const { openArtefactModal, toggleChecklistItem } = useEspace();

  // Ordre + tailles des modules, état local par montage (réinitialisé au
  // changement d'espace via la prop key posée par Center).
  const [order, setOrder] = useState<string[]>([]);
  const [conf, setConf] = useState<Record<string, ModuleConf>>({});
  const dragId = useRef<string | null>(null);

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
      openModal: () => openArtefactModal(a.id),
      render: () => (
        <>
          {a.chartData && <MiniBarChart data={a.chartData} />}
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

  const handleDrop = useCallback((targetId: string) => {
    const source = dragId.current;
    dragId.current = null;
    if (!source || source === targetId) return;
    setOrder(() => {
      const ids = orderedModules.map((m) => m.id);
      const from = ids.indexOf(source);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return ids;
      ids.splice(from, 1);
      ids.splice(to, 0, source);
      return ids;
    });
  }, [orderedModules]);

  function startResize(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const card = (e.currentTarget as HTMLElement).closest(`.${styles.card}`) as HTMLElement | null;
    if (!card) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startH = card.offsetHeight;
    const startSpan = conf[id]?.span ?? defaultSpan(id);
    const colWidth = card.offsetWidth / startSpan;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const span: 1 | 2 = dx > colWidth * 0.4 ? 2 : dx < -colWidth * 0.4 ? 1 : startSpan;
      const height = Math.max(140, startH + dy);
      setConf((prev) => ({ ...prev, [id]: { span, height } }));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("col-resizing");
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.classList.add("col-resizing");
  }

  function defaultSpan(id: string): 1 | 2 {
    // Les vues denses (timeline, réservations, carte) démarrent en pleine largeur.
    if (id.startsWith("tab-") || id === "map") return 2;
    return 1;
  }

  function toggleSpan(id: string) {
    setConf((prev) => {
      const current = prev[id]?.span ?? defaultSpan(id);
      return { ...prev, [id]: { ...prev[id], span: current === 2 ? 1 : 2 } };
    });
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

  return (
    <div className={styles.canvas}>
      {orderedModules.map((m) => {
        const c = conf[m.id] ?? { span: defaultSpan(m.id) };
        return (
          <section
            key={m.id}
            className={styles.card}
            style={{
              gridColumn: c.span === 2 ? "span 2" : "span 1",
              height: c.height ? `${c.height}px` : undefined,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(m.id)}
          >
            <header
              className={styles.cardHead}
              draggable
              onDragStart={(e) => {
                dragId.current = m.id;
                e.dataTransfer.effectAllowed = "move";
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
                  onClick={() => toggleSpan(m.id)}
                  title={c.span === 2 ? "Réduire à une demi-largeur" : "Étendre en pleine largeur"}
                  aria-label={c.span === 2 ? "Réduire le module" : "Agrandir le module"}
                >
                  {c.span === 2 ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 4H4v5M15 20h5v-5" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />
                    </svg>
                  )}
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
            <div className={styles.cardBody}>{m.render()}</div>
            <span
              className={styles.resizeHandle}
              onPointerDown={(e) => startResize(e, m.id)}
              title="Glisser pour redimensionner"
              aria-hidden="true"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.4">
                <path d="M9 1 1 9M9 5 5 9" />
              </svg>
            </span>
          </section>
        );
      })}
    </div>
  );
}
