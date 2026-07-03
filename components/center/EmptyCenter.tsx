"use client";

import type { Espace } from "@/lib/types";
import { useEspace } from "@/lib/context/EspaceContext";
import { SafeHTMLDoc } from "@/components/shared/SafeHTML";
import { MiniBarChart } from "@/components/shared/MiniBarChart";
import { ChecklistView } from "@/components/shared/ChecklistView";
import styles from "./EmptyCenter.module.css";

export function EmptyCenter({ espace }: { espace: Espace }) {
  const { openArtefactModal, toggleChecklistItem } = useEspace();

  if (espace.artefacts.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.icon}>{espace.icon}</div>
        <p className={styles.text}>
          Cet espace ne génère pas encore d&apos;artefact dédié. Ouvrez la conversation pour
          échanger avec votre assistant.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      {espace.artefacts.map((a) => (
        <div key={a.id} className={styles.card}>
          <button type="button" className={styles.cardHead} onClick={() => openArtefactModal(a.id)}>
            <span className={styles.cardTitle}>{a.title}</span>
            <span className={styles.cardMeta}>{a.type} · {a.date}</span>
          </button>
          {a.chartData && <MiniBarChart data={a.chartData} />}
          {a.checklistItems && (
            <ChecklistView
              items={a.checklistItems}
              onToggle={(i) => toggleChecklistItem(a.id, i)}
            />
          )}
          {a.body && <SafeHTMLDoc className={styles.cardBody} html={a.body} />}
        </div>
      ))}
    </div>
  );
}
