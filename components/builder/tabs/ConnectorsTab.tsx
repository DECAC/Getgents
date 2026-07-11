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
  connecteur: "sage",
  "connecteur-predefini": "sage",
  "connecteur-personnalise": "sage",
  "api-rest": "sage",
};

export function ConnectorsTab() {
  const { currentDraft, addToolInstance, renameToolInstance, removeToolInstance } = useBuilder();
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConnectorToolKind | "all">("all");
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);

  const typeByKind = Object.fromEntries(CONNECTOR_TOOL_TYPES.map((t) => [t.kind, t]));
  const realConnectors = currentDraft.connectors.filter(isRealConnector);
  const simulatedCount = currentDraft.connectors.length - realConnectors.length;
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
    addToolInstance(kind);
  }

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>Sources de données réelles du gent</h4>
      <p className={styles.sectionSub}>
        Seules les sources <b>réellement appelées en production</b> sont listées ici — aucune donnée
        simulée. C&apos;est exactement ce que le gent utilise pour répondre.
      </p>
      {realConnectors.length === 0 && !currentDraft.webSearch ? (
        <div className={styles.list}>
          <div className={styles.empty}>
            Aucune source de données réelle pour l&apos;instant. Ajoutez un serveur MCP ou un dataset
            open data ci-dessous, ou activez la recherche web dans l&apos;onglet Prompt.
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
          {realConnectors.map((instance) => {
            const type = typeByKind[instance.toolKind];
            const ref = instance.toolKind === "dataset" && instance.detail ? parseDatasetUrl(instance.detail) : null;
            return (
              <div className={styles.row} key={instance.id}>
                <div className={styles.ic}>{type?.icon ?? "🔌"}</div>
                <div className={styles.info}>
                  <div className={styles.nameRow}>
                    <input
                      className={styles.nameInput}
                      defaultValue={instance.name}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== instance.name) renameToolInstance(instance.id, value);
                        else e.target.value = instance.name;
                      }}
                      aria-label={`Nom de l'outil ${instance.name}`}
                    />
                    <span
                      className={[styles.statusBadge, styles.statusReal].join(" ")}
                      title="Cette source est réellement appelée par le gent en production."
                    >
                      ● Connecté
                    </span>
                  </div>
                  <div className={styles.typeTag}>{type?.name ?? instance.toolKind}</div>
                  <dl className={styles.factList}>
                    {ref ? (
                      <>
                        <div><dt>Portail</dt><dd>{ref.domain}</dd></div>
                        <div><dt>Dataset</dt><dd>{ref.datasetId}</dd></div>
                        <div><dt>Outil exposé au modèle</dt><dd><code>dataset_{ref.datasetId.replace(/[^a-zA-Z0-9_]/g, "_")}__nearby(lat, lon)</code></dd></div>
                        <div><dt>Capacité</dt><dd>Recherche des enregistrements les plus proches d&apos;une position (API Opendatasoft Explore v2.1, tri par distance)</dd></div>
                      </>
                    ) : (
                      <>
                        <div><dt>Point de terminaison</dt><dd>{instance.detail}</dd></div>
                        <div><dt>Transport</dt><dd>MCP Streamable HTTP — outils découverts à la connexion, appelés dans la boucle d&apos;outils de /api/chat</dd></div>
                      </>
                    )}
                  </dl>
                  {instance.detail && <div className={styles.detail}>{instance.detail}</div>}
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

      <div className={styles.addPanel}>
        <h4 className={styles.addTitle}>Ajouter un outil</h4>
        <p className={styles.addSub}>Créez un outil en choisissant son type ci-dessous.</p>

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
