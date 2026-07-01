"use client";

import { useEspace } from "@/lib/context/EspaceContext";
import type { Tool } from "@/lib/types";
import styles from "./ToolsTab.module.css";

const CAT_LABEL: Record<string, string> = {
  lecture: "Lecture seule",
  ecriture: "Écriture — confirmation requise",
  compte_tiers: "Compte tiers — vous payez là-bas",
};

const TIC_CLASS: Record<string, string> = {
  lecture: styles.ticLecture,
  ecriture: styles.ticEcriture,
  compte_tiers: styles.ticCompte,
};

const RISK_CLASS: Record<string, string> = {
  lecture: styles.riskLecture,
  ecriture: styles.riskEcriture,
  compte_tiers: styles.riskCompte,
};

export function ToolsTab({ tools }: { tools: Tool[] }) {
  const { connectTool } = useEspace();

  return (
    <div className={styles.wrap}>
      <div className={styles.daydiv}>— Tools de ce gent —</div>
      <div className={styles.list}>
        {tools.map((tool) => (
          <div key={tool.id} className={styles.row}>
            <div className={[styles.tic, TIC_CLASS[tool.category]].join(" ")}>{tool.icon}</div>
            <div className={styles.info}>
              <div className={styles.name}>
                {tool.name}
                <span className={[styles.riskBadge, RISK_CLASS[tool.category]].join(" ")}>
                  {CAT_LABEL[tool.category]}
                </span>
              </div>
              <div className={styles.desc}>{tool.desc}</div>
            </div>
            {tool.category === "compte_tiers" &&
              (tool.connected ? (
                <span className={styles.connectOn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Connecté
                </span>
              ) : (
                <button className={styles.connectOff} onClick={() => connectTool(tool.name)}>
                  Connecter
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          Getgents ne déclenche jamais de paiement et ne stocke aucun moyen de paiement. Pour les
          comptes tiers connectés, chaque proposition reste soumise à votre validation explicite, et
          le paiement se fait toujours chez le prestataire — jamais sur Getgents.
        </span>
      </div>
    </div>
  );
}
