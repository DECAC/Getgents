"use client";

import { useBuilder } from "@/lib/context/BuilderContext";
import { CONNECTOR_CATALOG } from "@/lib/mock-data/builder";
import styles from "./ConnectorsTab.module.css";

const KIND_CLASS: Record<string, string> = { mcp: styles.kindMcp, a2a: styles.kindA2a };
const KIND_LABEL: Record<string, string> = { mcp: "MCP", a2a: "A2A" };
const CAT_LABEL: Record<string, string> = {
  lecture: "Lecture seule",
  ecriture: "Écriture",
  compte_tiers: "Compte tiers",
};
const CAT_CLASS: Record<string, string> = {
  lecture: styles.catLecture,
  ecriture: styles.catEcriture,
  compte_tiers: styles.catCompte,
};

export function ConnectorsTab() {
  const { currentDraft, toggleConnector, addConnector } = useBuilder();

  const availableToAdd = CONNECTOR_CATALOG.filter(
    (c) => !currentDraft.connectors.some((added) => added.id === c.id)
  );

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>Connecteurs de ce gent</h4>
      {currentDraft.connectors.length === 0 ? (
        <div className={styles.empty}>
          Aucun connecteur pour l&apos;instant. Ajoutez-en un depuis le catalogue ci-dessous pour
          permettre au gent d&apos;interagir avec d&apos;autres systèmes.
        </div>
      ) : (
        <div className={styles.list}>
          {currentDraft.connectors.map((c) => (
            <div className={styles.row} key={c.id}>
              <div className={styles.ic}>{c.icon}</div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {c.name}
                  <span className={[styles.kindBadge, KIND_CLASS[c.kind]].join(" ")}>{KIND_LABEL[c.kind]}</span>
                  <span className={[styles.catBadge, CAT_CLASS[c.category]].join(" ")}>{CAT_LABEL[c.category]}</span>
                </div>
                <div className={styles.desc}>{c.desc}</div>
                <div className={styles.endpoint}>{c.endpointHint}</div>
              </div>
              {c.connected ? (
                <button className={[styles.connectBtn, styles.connectOn].join(" ")} onClick={() => toggleConnector(c.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l2 2 4-4" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  Connecté
                </button>
              ) : (
                <button className={[styles.connectBtn, styles.connectOff].join(" ")} onClick={() => toggleConnector(c.id)}>
                  Connecter
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h4 className={styles.sectionTitle}>Catalogue disponible</h4>
      {availableToAdd.length === 0 ? (
        <div className={styles.empty}>Tous les connecteurs du catalogue ont déjà été ajoutés.</div>
      ) : (
        <div className={styles.list}>
          {availableToAdd.map((c) => (
            <div className={styles.row} key={c.id}>
              <div className={styles.ic}>{c.icon}</div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {c.name}
                  <span className={[styles.kindBadge, KIND_CLASS[c.kind]].join(" ")}>{KIND_LABEL[c.kind]}</span>
                  <span className={[styles.catBadge, CAT_CLASS[c.category]].join(" ")}>{CAT_LABEL[c.category]}</span>
                </div>
                <div className={styles.desc}>{c.desc}</div>
                <div className={styles.endpoint}>{c.endpointHint}</div>
              </div>
              <button className={styles.addBtn} onClick={() => addConnector(c.id)}>
                + Ajouter
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          Les connecteurs « Compte tiers » sont connectés par l&apos;utilisateur final dans son propre
          espace — jamais par le builder. Getgents ne stocke aucun identifiant de ces comptes.
        </span>
      </div>
    </div>
  );
}
