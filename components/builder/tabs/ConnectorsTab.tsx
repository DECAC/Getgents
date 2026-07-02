"use client";

import { useMemo, useState } from "react";
import { useBuilder } from "@/lib/context/BuilderContext";
import { CONNECTOR_TOOL_TYPES } from "@/lib/mock-data/builder";
import { McpConfigModal } from "../McpConfigModal";
import type { ConnectorToolKind } from "@/lib/types/builder";
import styles from "./ConnectorsTab.module.css";

// Les 4 types mis en avant en accès rapide, comme les raccourcis de création
// d'un écran d'ajout d'outil classique.
const FEATURED_KINDS: ConnectorToolKind[] = ["ordinateur", "flux-assistant", "invite", "mcp"];
const FEATURED_STYLE: Record<ConnectorToolKind, string> = {
  ordinateur: "gold",
  "flux-assistant": "sage",
  invite: "plum",
  mcp: "ink",
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

  const typeByKind = Object.fromEntries(CONNECTOR_TOOL_TYPES.map((t) => [t.kind, t]));
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
    addToolInstance(kind);
  }

  return (
    <div className={styles.wrap}>
      <h4 className={styles.sectionTitle}>Outils configurés pour ce gent</h4>
      {currentDraft.connectors.length === 0 ? (
        <div className={styles.empty}>
          Aucun outil pour l&apos;instant. Ajoutez-en un depuis la section ci-dessous pour commencer
          à le configurer.
        </div>
      ) : (
        <div className={styles.list}>
          {currentDraft.connectors.map((instance) => {
            const type = typeByKind[instance.toolKind];
            return (
              <div className={styles.row} key={instance.id}>
                <div className={styles.ic}>{type?.icon ?? "🔌"}</div>
                <div className={styles.info}>
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
                  <div className={styles.typeTag}>{type?.name ?? instance.toolKind}</div>
                  <div className={styles.desc}>{type?.description}</div>
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
          Les connecteurs personnalisés et API REST demandent des autorisations d&apos;affichage et
          de partage pour l&apos;organisation avant que l&apos;assistant puisse les utiliser en
          production.
        </span>
      </div>

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
