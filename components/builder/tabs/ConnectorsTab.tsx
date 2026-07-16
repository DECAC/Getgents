"use client";

import { useMemo, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
import { McpConfigModal } from "../McpConfigModal";
import { DatasetConfigModal } from "../DatasetConfigModal";
import { parseDatasetUrl } from "@/lib/opendatasoft";
import type { ConnectorToolKind } from "@/lib/types/builder";
import styles from "./ConnectorsTab.module.css";

// Seuls un serveur MCP avec une URL http(s) et un dataset open data reconnu
// sont réellement appelés en production (boucle d'outils dans /api/chat) —
// tous les autres types sont affichés dans l'espace publié mais ne
// déclenchent aucun appel réel.
function isRealConnector(instance: { toolKind: ConnectorToolKind; detail?: string }): boolean {
  if (instance.toolKind === "mcp") {
    return !!instance.detail && /^https?:\/\//.test(instance.detail);
  }
  if (instance.toolKind === "dataset") {
    return !!instance.detail && parseDatasetUrl(instance.detail) !== null;
  }
  // PRIM : réellement appelé côté serveur ; nécessite PRIM_API_KEY sur
  // l'hébergement (sinon l'outil renvoie une erreur explicite au gent).
  if (instance.toolKind === "prim") return true;
  return false;
}

// Les 4 types mis en avant en accès rapide, comme les raccourcis de création
// d'un écran d'ajout d'outil classique.
const FEATURED_KINDS: ConnectorToolKind[] = ["ordinateur", "flux-assistant", "invite", "mcp"];
const FEATURED_STYLE: Record<ConnectorToolKind, string> = {
  ordinateur: "gold",
  "flux-assistant": "sage",
  invite: "plum",
  mcp: "ink",
  dataset: "gold",
  prim: "sage",
  connecteur: "sage",
  "connecteur-predefini": "sage",
  "connecteur-personnalise": "sage",
  "api-rest": "sage",
};

export function ConnectorsTab() {
  const { currentDraft, addToolInstance, removeToolInstance } = useBuilder();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConnectorToolKind | "all">("all");
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);

  const typeByKind = Object.fromEntries(CONNECTOR_TOOL_TYPES.map((t) => [t.kind, t]));
  const enabledConnectors = currentDraft.connectors;
  const enabledKinds = new Set(enabledConnectors.map((c) => c.toolKind));
  const inactiveTypes = CONNECTOR_TOOL_TYPES.filter((t) => !enabledKinds.has(t.kind));

  const realConnectors = enabledConnectors.filter(isRealConnector);
  const simulatedCount = enabledConnectors.length - realConnectors.length;
  const featuredTypes = FEATURED_KINDS.map((kind) => typeByKind[kind]).filter(Boolean);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTypes = useMemo(() => {
    return CONNECTOR_TOOL_TYPES.filter((t) => {
      const matchesFilter = activeFilter === "all" || t.kind === activeFilter;
      const matchesQuery =
        normalizedQuery === "" ||
        t.name.toLowerCase().includes(normalizedQuery) ||
        t.description.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, normalizedQuery]);

  function handleAddClick(kind: ConnectorToolKind) {
    if (kind === "mcp") {
      setMcpModalOpen(true);
      return;
    }
    if (kind === "dataset") {
      setDatasetModalOpen(true);
      return;
    }
    if (kind === "prim") {
      addToolInstance("prim", {
        name: "IDFM PRIM — transports IDF",
        detail: "https://prim.iledefrance-mobilites.fr/marketplace",
      });
      return;
    }
    addToolInstance(kind);
  }

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>1 — Connecteurs activés dans le gent</h4>
      <p className={styles.sectionSub}>
        Connecteurs ajoutés au gent. <b>● Connecté</b> = réellement appelés en production, <b>○ Simulé</b> =
        configuré mais non exécutable en production (aperçu / simulation).
      </p>
      {enabledConnectors.length === 0 && !currentDraft.webSearch ? (
        <div className={styles.list}>
          <div className={styles.empty}>
            Aucun connecteur n&apos;a encore été ajouté au gent. Ajoutez un serveur MCP ou un dataset open
            data ci-dessous, ou activez la recherche web dans l&apos;onglet Prompt.
          </div>
          {simulatedCount > 0 && (
            <div className={styles.hiddenNote}>
              {simulatedCount} outil{simulatedCount > 1 ? "s" : ""} simulé{simulatedCount > 1 ? "s" : ""} (aperçu
              uniquement, aucun appel réel) masqué{simulatedCount > 1 ? "s" : ""} de cette vue.
            </div>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {enabledConnectors.map((instance) => {
            const type = typeByKind[instance.toolKind];
            const ref = instance.toolKind === "dataset" && instance.detail ? parseDatasetUrl(instance.detail) : null;
            return (
              <div className={styles.row} key={instance.id}>
                <div className={styles.ic}>{type?.icon ?? "🔌"}</div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <span className={styles.staticName}>{instance.name}</span>
                    <span
                      className={[
                        styles.statusBadge,
                        isRealConnector(instance) ? styles.statusReal : styles.statusSimulated,
                      ].join(" ")}
                      title={
                        isRealConnector(instance)
                          ? "Cette source est réellement appelée par le gent en production."
                          : "Connecteur configuré mais non exécutable en production (aperçu / simulé)."
                      }
                    >
                      {isRealConnector(instance) ? "● Connecté" : "○ Simulé"}
                    </span>
                  </div>
                  <div className={styles.typeTag}>{type?.name ?? instance.toolKind}</div>
                  {ref ? (
                    <div className={styles.metaLine}>
                      {ref.domain} · {ref.datasetId}
                    </div>
                  ) : instance.toolKind === "prim" ? (
                    <div className={styles.metaLine}>PRIM (temps réel) — transports IDF</div>
                  ) : instance.detail ? (
                    <div className={styles.metaLine}>{instance.detail}</div>
                  ) : null}
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
                <dl className={styles.factList}>
                  <div><dt>Mécanisme</dt><dd>Plugin web OpenRouter — résultats web récents injectés à chaque réponse</dd></div>
                  <div><dt>Activation</dt><dd>Onglet Prompt → « Recherche web »</dd></div>
                </dl>
              </div>
            </div>
          )}
          {simulatedCount > 0 && (
            <div className={styles.hiddenNote}>
              {simulatedCount} outil{simulatedCount > 1 ? "s" : ""} simulé{simulatedCount > 1 ? "s" : ""} (aperçu
              uniquement, aucun appel réel) masqué{simulatedCount > 1 ? "s" : ""} de cette vue.
            </div>
          )}
        </div>
      )}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>2 — Connecteurs inactifs mais activables</h4>
        <p className={styles.sectionSub}>
          Liste exhaustive des types disponibles que vous n’avez pas encore ajoutés au gent.
        </p>

        {inactiveTypes.length === 0 ? (
          <div className={styles.empty}>Vous avez activé tous les types disponibles.</div>
        ) : (
          <div className={styles.inactiveGrid}>
            {inactiveTypes.map((t) => (
              <div className={styles.inactiveCard} key={t.kind}>
                <div className={styles.inactiveTop}>
                  <div className={styles.inactiveIcon}>{t.icon}</div>
                  <div className={styles.inactiveName}>{t.name}</div>
                </div>
                <div className={styles.inactiveDesc}>{t.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.addPanel}>
        <h4 className={styles.addTitle}>3 — Ajouter un connecteur</h4>
        <p className={styles.addSub}>Recherchez un connecteur ci-dessous puis cliquez sur <b>+ Ajouter</b>.</p>

        <div className={styles.searchRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Recherchez par scénario, par exemple « envoyer un e-mail »"
            aria-label="Rechercher un type d'outil"
          />
        </div>

        <div className={styles.featuredRow}>
          {featuredTypes.map((type) => (
            <button
              key={type.kind}
              className={styles.featuredCard}
              onClick={() => handleAddClick(type.kind)}
            >
              <div className={[styles.featuredIc, styles[`tone-${FEATURED_STYLE[type.kind]}`]].join(" ")}>
                {type.icon}
              </div>
              <div>
                <div className={styles.featuredKicker}>Ajouter un nouvel élément</div>
                <div className={styles.featuredName}>{type.name}</div>
              </div>
            </button>
          ))}
        </div>

        <div className={styles.pillRow}>
          <button
            className={[styles.pill, activeFilter === "all" ? styles.pillActive : ""].filter(Boolean).join(" ")}
            onClick={() => setActiveFilter("all")}
          >
            Tous
          </button>
          {CONNECTOR_TOOL_TYPES.map((type) => (
            <button
              key={type.kind}
              className={[styles.pill, activeFilter === type.kind ? styles.pillActive : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveFilter(type.kind)}
            >
              {type.icon} {type.name}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {filteredTypes.length === 0 ? (
            <div className={styles.noMatch}>Aucun type d&apos;outil ne correspond à « {query} ».</div>
          ) : (
            filteredTypes.map((type) => (
              <div className={styles.typeCard} key={type.kind}>
                <div className={styles.typeTop}>
                  <div className={styles.typeIc}>{type.icon}</div>
                  <span className={styles.typeName}>{type.name}</span>
                </div>
                <div className={styles.typeDesc}>{type.description}</div>
                <button className={styles.typeAddBtn} onClick={() => handleAddClick(type.kind)}>
                  + Ajouter
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.note}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          Cette vue ne liste que les sources <b>réellement appelées</b> par le gent : serveurs{" "}
          <b>MCP</b> avec URL, <b>datasets open data</b> reconnus et <b>recherche web</b>. Les
          autres types ajoutés ci-dessous (connecteur, API REST, flux d&apos;assistant…) restent
          simulés dans cette maquette et n&apos;apparaissent pas dans la liste.
        </span>
      </div>

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
    </div>
  );
}
