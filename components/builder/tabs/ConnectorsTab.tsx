"use client";

import { useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
import { McpConfigModal } from "../McpConfigModal";
import { DatasetConfigModal } from "../DatasetConfigModal";
import { RestApiConfigModal } from "../RestApiConfigModal";
import { parseDatasetUrl } from "@/lib/opendatasoft";
import type { ConnectorToolKind, GentToolInstance } from "@/lib/types/builder";
import styles from "./ConnectorsTab.module.css";

/** Types réellement appelés en production (MCP, dataset open data, API REST, PRIM, Powens sandbox). */
const REAL_KINDS: ConnectorToolKind[] = ["mcp", "dataset", "api-rest", "prim", "powens"];

function isRealConnector(instance: GentToolInstance): boolean {
  if (instance.toolKind === "mcp") {
    return !!instance.detail && /^https?:\/\//.test(instance.detail);
  }
  if (instance.toolKind === "dataset") {
    return !!instance.detail && parseDatasetUrl(instance.detail) !== null;
  }
  if (instance.toolKind === "api-rest") {
    return !!instance.restConfig && /^https?:\/\//.test(instance.restConfig.baseUrl);
  }
  if (instance.toolKind === "prim") return true;
  if (instance.toolKind === "powens") return true;
  return false;
}

function metaLine(instance: GentToolInstance): string | null {
  if (instance.toolKind === "dataset" && instance.detail) {
    const ref = parseDatasetUrl(instance.detail);
    if (ref) return `${ref.domain} · ${ref.datasetId}`;
  }
  if (instance.toolKind === "api-rest" && instance.restConfig) {
    return `${instance.restConfig.method} ${instance.restConfig.baseUrl}`;
  }
  if (instance.toolKind === "prim") return "PRIM (temps réel) — transports IDF";
  if (instance.toolKind === "powens") return "Powens SANDBOX — secrets côté serveur (POWENS_*)";
  if (instance.detail) return instance.detail;
  return null;
}

export function ConnectorsTab() {
  const { currentDraft, addToolInstance, updateToolInstance, removeToolInstance } = useBuilder();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [editRestId, setEditRestId] = useState<string | null>(null);

  const typeByKind = Object.fromEntries(CONNECTOR_TOOL_TYPES.map((t) => [t.kind, t]));
  const activated = currentDraft.connectors.filter(isRealConnector);
  const activatedKinds = new Set(activated.map((c) => c.toolKind));
  const activableTypes = CONNECTOR_TOOL_TYPES.filter(
    (t) => REAL_KINDS.includes(t.kind) && !activatedKinds.has(t.kind)
  );

  function handleAddClick(kind: ConnectorToolKind) {
    setShowAddMenu(false);
    if (kind === "mcp") {
      setMcpModalOpen(true);
      return;
    }
    if (kind === "dataset") {
      setDatasetModalOpen(true);
      return;
    }
    if (kind === "api-rest") {
      setRestModalOpen(true);
      return;
    }
    if (kind === "prim") {
      addToolInstance("prim", {
        name: "IDFM PRIM — transports IDF",
        detail: "https://prim.iledefrance-mobilites.fr/marketplace",
      });
    }
    if (kind === "powens") {
      addToolInstance("powens", {
        name: "Powens — comptes & transactions (sandbox)",
        detail: "https://webview.powens.com (sandbox)",
      });
    }
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Connecteurs activés dans le gent</h4>
        <p className={styles.sectionSub}>Sources réellement appelées par le gent en production.</p>

        {activated.length === 0 && !currentDraft.webSearch ? (
          <div className={styles.empty}>Aucun connecteur activé pour l&apos;instant.</div>
        ) : (
          <div className={styles.list}>
            {activated.map((instance) => {
              const type = typeByKind[instance.toolKind];
              const meta = metaLine(instance);
              return (
                <div className={styles.row} key={instance.id}>
                  <div className={styles.ic}>{type?.icon ?? "🔌"}</div>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.staticName}>{instance.name}</span>
                      <span className={[styles.statusBadge, styles.statusReal].join(" ")}>● Connecté</span>
                    </div>
                    <div className={styles.typeTag}>{type?.name ?? instance.toolKind}</div>
                    {meta ? <div className={styles.metaLine}>{meta}</div> : null}
                    {instance.toolKind === "powens" && (
                      <a className={styles.rowAction} href="/api/powens/connect" target="_blank" rel="noopener noreferrer">
                        🔗 Lier un compte bancaire sandbox (webview de consentement)
                      </a>
                    )}
                    {instance.toolKind === "api-rest" && instance.restConfig && (
                      <button
                        type="button"
                        className={styles.rowAction}
                        onClick={() => {
                          setEditRestId(instance.id);
                          setRestModalOpen(true);
                        }}
                      >
                        ✏️ Modifier la configuration (URL, clé, paramètres)
                      </button>
                    )}
                  </div>
                  <button
                    className={styles.removeBtn}
                    onClick={() => removeToolInstance(instance.id)}
                    aria-label={`Retirer ${instance.name}`}
                  >
                    Retirer
                  </button>
                </div>
              );
            })}
            {currentDraft.webSearch && (
              <div className={styles.row}>
                <div className={styles.ic}>🌐</div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.staticName}>Recherche web</span>
                    <span className={[styles.statusBadge, styles.statusReal].join(" ")}>● Actif</span>
                  </div>
                  <div className={styles.typeTag}>Source web temps réel</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Connecteurs activables</h4>
        {activableTypes.length === 0 ? (
          <div className={styles.empty}>Tous les connecteurs réels sont déjà activés.</div>
        ) : (
          <ul className={styles.nameList}>
            {activableTypes.map((t) => (
              <li key={t.kind} className={styles.nameListItem}>
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowAddMenu((v) => !v)}
          aria-expanded={showAddMenu}
        >
          + Ajouter un connecteur
        </button>

        {showAddMenu && (
          <div className={styles.addMenu} role="menu">
            {REAL_KINDS.map((kind) => {
              const type = typeByKind[kind];
              if (!type) return null;
              return (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  className={styles.addMenuItem}
                  onClick={() => handleAddClick(kind)}
                >
                  <span className={styles.addMenuIcon}>{type.icon}</span>
                  {type.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {datasetModalOpen && (
        <DatasetConfigModal
          onClose={() => setDatasetModalOpen(false)}
          onSubmit={({ name, url }) => {
            addToolInstance("dataset", { name, detail: url });
            setDatasetModalOpen(false);
          }}
        />
      )}

      {mcpModalOpen && (
        <McpConfigModal
          onClose={() => setMcpModalOpen(false)}
          onSubmit={({ name, url }) => {
            addToolInstance("mcp", { name, detail: url });
            setMcpModalOpen(false);
          }}
        />
      )}

      {restModalOpen && (() => {
        const editing = editRestId ? currentDraft.connectors.find((c) => c.id === editRestId) : undefined;
        const initial =
          editing && editing.restConfig ? { name: editing.name, config: editing.restConfig } : undefined;
        const close = () => {
          setRestModalOpen(false);
          setEditRestId(null);
        };
        return (
          <RestApiConfigModal
            initial={initial}
            onClose={close}
            onSubmit={({ name, config }) => {
              if (editRestId) {
                updateToolInstance(editRestId, {
                  name,
                  detail: `${config.method} ${config.baseUrl}`,
                  restConfig: config,
                });
              } else {
                addToolInstance("api-rest", {
                  name,
                  detail: `${config.method} ${config.baseUrl}`,
                  restConfig: config,
                });
              }
              close();
            }}
          />
        );
      })()}
    </div>
  );
}
