"use client";

import { useMemo, useState } from "react";
import type { AppBlock, AppContactStatus, AppModuleSpec, AppPreviewSpec } from "@/lib/appPreview";
import styles from "./AppPreview.module.css";

/* ------------------------------------------------------------------ icônes */

function IconCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg className={styles.calloutIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", color: "var(--faint)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .14s ease" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconModule() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------- blocs */

const CONTACT_STATUS_LABEL: Record<AppContactStatus, string> = {
  todo: "à contacter",
  sent: "message envoyé",
  replied: "a répondu",
};

const CONTACT_STATUS_CLASS: Record<AppContactStatus, string> = {
  todo: styles.stTodo,
  sent: styles.stSent,
  replied: styles.stReplied,
};

const NEXT_STATUS: Record<AppContactStatus, AppContactStatus> = {
  todo: "sent",
  sent: "replied",
  replied: "todo",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface BlockViewProps {
  block: AppBlock;
  /** Clé stable module+bloc, pour mémoriser les interactions de démonstration. */
  path: string;
  state: InteractionState;
}

/** État des interactions locales : l'aperçu se manipule, sans rien persister. */
interface InteractionState {
  checked: Record<string, boolean>;
  toggleCheck: (key: string, fallback: boolean) => void;
  open: Record<string, boolean>;
  toggleOpen: (key: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  statuses: Record<string, AppContactStatus>;
  cycleStatus: (key: string, current: AppContactStatus) => void;
}

function BlockView({ block, path, state }: BlockViewProps) {
  switch (block.kind) {
    case "heading":
      return <h4 className={styles.blockHeading}>{block.text}</h4>;

    case "text":
      return <p className={styles.blockText}>{block.text}</p>;

    case "stats":
      return (
        <div className={styles.stats}>
          {block.items.map((s, i) => (
            <div key={i} className={styles.stat}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
              {s.delta ? (
                <div className={`${styles.statDelta} ${s.dir === "down" ? styles.deltaDown : styles.deltaUp}`}>
                  {s.dir === "down" ? "▼" : "▲"} {s.delta}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      );

    case "chart": {
      const max = Math.max(...block.series.map((p) => p.value), 1);
      return (
        <div>
          <div className={styles.chart}>
            {block.series.map((p, i) => (
              <div key={i} className={styles.chartCol}>
                <div
                  className={`${styles.bar} ${p.value < max * 0.55 ? styles.barMuted : ""}`}
                  style={{ height: `${Math.max(6, (p.value / max) * 100)}%` }}
                  title={`${p.label} : ${p.value}`}
                />
                <span className={styles.barLabel}>{p.label}</span>
              </div>
            ))}
          </div>
          {block.caption ? <div className={styles.chartCaption}>{block.caption}</div> : null}
        </div>
      );
    }

    case "table":
      return (
        <table className={styles.table}>
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={i} className={block.numeric?.includes(i) ? styles.tdNum : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {block.columns.map((_, ci) => (
                  <td key={ci} className={block.numeric?.includes(ci) ? styles.tdNum : undefined}>
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "callout": {
      const toneClass =
        block.tone === "warning" ? styles.calloutWarning : block.tone === "success" ? styles.calloutSuccess : styles.calloutInfo;
      return (
        <div className={`${styles.callout} ${toneClass}`}>
          <IconInfo />
          <div>
            {block.title ? <strong className={styles.calloutTitle}>{block.title}</strong> : null}
            {block.text}
          </div>
        </div>
      );
    }

    case "checklist":
      return (
        <div className={styles.checklist}>
          {block.items.map((item, i) => {
            const key = `${path}:${i}`;
            const done = state.checked[key] ?? item.done;
            return (
              <button key={i} type="button" className={styles.checkRow} onClick={() => state.toggleCheck(key, item.done)}>
                <span className={`${styles.box} ${done ? styles.boxOn : ""}`}>
                  <IconCheck />
                </span>
                <span className={done ? styles.checkDone : undefined}>{item.label}</span>
              </button>
            );
          })}
        </div>
      );

    case "profile":
      return (
        <>
          <div className={styles.profile}>
            <div className={styles.avatar}>{block.initials}</div>
            <div className={styles.profileMain}>
              <div className={styles.profileName}>{block.name}</div>
              {block.headline ? <div className={styles.headline}>{block.headline}</div> : null}
              {block.facts.length ? (
                <div className={styles.facts}>
                  {block.facts.map((f, i) => (
                    <div key={i}>
                      <div className={styles.factValue}>{f.value}</div>
                      <div className={styles.factLabel}>{f.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {block.chips.length ? (
            <div className={styles.chips}>
              {block.chips.map((c, i) => (
                <span key={i} className={styles.chip}>
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {block.completeness !== undefined ? (
            <div>
              <div className={styles.meterRow}>
                <span className={styles.meterLabel}>Complétude du profil</span>
                <span className={styles.meterValue}>{block.completeness} %</span>
              </div>
              <div className={styles.meter}>
                <div className={styles.meterFill} style={{ width: `${block.completeness}%` }} />
              </div>
            </div>
          ) : null}
        </>
      );

    case "contacts":
      return (
        <div className={styles.contacts}>
          {block.items.map((c, i) => {
            const key = `${path}:${i}`;
            const status = state.statuses[key] ?? c.status;
            return (
              <div key={i} className={styles.contactRow}>
                <div className={styles.contactAvatar}>{initialsOf(c.name)}</div>
                <div className={styles.contactMain}>
                  <div className={styles.contactName}>{c.name}</div>
                  <div className={styles.contactRole}>
                    {c.role}
                    {c.last ? ` · ${c.last}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.statusPill} ${CONTACT_STATUS_CLASS[status]}`}
                  onClick={() => state.cycleStatus(key, status)}
                  title="Changer le statut"
                >
                  {CONTACT_STATUS_LABEL[status]}
                </button>
              </div>
            );
          })}
        </div>
      );

    case "cards": {
      const filterKey = path;
      const active = state.filters[filterKey] ?? block.filters?.[0] ?? "";
      const visible = block.items.filter((it) => {
        if (!block.filters || !active || active === block.filters[0]) return true;
        const hay = `${it.title} ${it.subtitle ?? ""} ${(it.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(active.toLowerCase());
      });
      return (
        <>
          {block.filters?.length ? (
            <div className={styles.filters}>
              {block.filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.filterChip} ${f === active ? styles.filterChipOn : ""}`}
                  onClick={() => state.setFilter(filterKey, f)}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.cardList}>
            {visible.map((it, i) => {
              const key = `${path}:${it.title}`;
              const open = !!state.open[key];
              const hasDetail = !!(it.note || (it.tags && it.tags.length));
              return (
                <div key={i} className={`${styles.item} ${open ? styles.itemOpen : ""}`}>
                  <button type="button" className={styles.itemHead} onClick={() => hasDetail && state.toggleOpen(key)}>
                    <div className={styles.itemMain}>
                      <div className={styles.itemTitle}>{it.title}</div>
                      {it.subtitle ? <div className={styles.itemMeta}>{it.subtitle}</div> : null}
                    </div>
                    {it.score !== undefined ? (
                      <div className={styles.itemScore}>
                        <div className={styles.itemScoreValue}>{it.score} %</div>
                        <div className={styles.scoreBar}>
                          <div
                            className={`${styles.scoreFill} ${it.score < 75 ? styles.scoreFillMid : ""}`}
                            style={{ width: `${it.score}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                    {hasDetail ? <IconChevron open={open} /> : null}
                  </button>
                  {open ? (
                    <div className={styles.itemBody}>
                      {it.tags?.length ? (
                        <div className={styles.tags}>
                          {it.tags.map((t, ti) => (
                            <span key={ti} className={styles.tag}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {it.note ? <p className={styles.note}>{it.note}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      );
    }

    case "actions":
      return (
        <div className={styles.actionPills}>
          {block.items.map((a, i) => (
            <button key={i} type="button" className={styles.actionPill}>
              {a}
            </button>
          ))}
        </div>
      );

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ module */

const SIZE_CLASS = {
  compact: styles.sizeCompact,
  standard: styles.sizeStandard,
  large: styles.sizeLarge,
  full: styles.sizeFull,
};

function ModuleCard({ module, fresh, state }: { module: AppModuleSpec; fresh: boolean; state: InteractionState }) {
  return (
    <article className={`${styles.card} ${SIZE_CLASS[module.size]} ${fresh ? styles.cardFresh : ""}`}>
      <header className={styles.head}>
        <div className={styles.glyph}>
          <IconModule />
        </div>
        <div className={styles.headText}>
          <div className={styles.title}>{module.title}</div>
          <div className={styles.meta}>{module.source ? `via ${module.source}` : "données simulées"}</div>
        </div>
        {fresh ? <span className={styles.newTag}>nouveau</span> : null}
      </header>
      <div className={styles.body}>
        {module.blocks.map((b, i) => (
          <BlockView key={i} block={b} path={`${module.id}:${i}`} state={state} />
        ))}
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className={`${styles.skeletonCard} ${styles.sizeLarge}`}>
      <div className={styles.shimmer} style={{ width: "42%" }} />
      <div className={`${styles.shimmer} ${styles.shimmerBlock}`} />
      <div className={styles.shimmer} style={{ width: "70%" }} />
    </div>
  );
}

/* ----------------------------------------------------------------- aperçu */

export function AppPreview({
  spec,
  freshIds = [],
  building = false,
}: {
  spec: AppPreviewSpec;
  /** Modules issus du dernier tour de l'assistant — signalés « nouveau ». */
  freshIds?: string[];
  /** Une génération est en cours : une tuile fantôme l'annonce. */
  building?: boolean;
}) {
  const [theme, setTheme] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, AppContactStatus>>({});

  const themes = spec.themes.length ? spec.themes : ["Vue d'ensemble"];
  const activeTheme = theme && themes.includes(theme) ? theme : themes[0];

  const state: InteractionState = useMemo(
    () => ({
      checked,
      toggleCheck: (key, fallback) => setChecked((p) => ({ ...p, [key]: !(p[key] ?? fallback) })),
      open,
      toggleOpen: (key) => setOpen((p) => ({ ...p, [key]: !p[key] })),
      filters,
      setFilter: (key, value) => setFilters((p) => ({ ...p, [key]: value })),
      statuses,
      cycleStatus: (key, current) => setStatuses((p) => ({ ...p, [key]: NEXT_STATUS[current] })),
    }),
    [checked, open, filters, statuses]
  );

  const visible = spec.modules.filter((m) => m.theme === activeTheme || themes.length === 1);

  return (
    <div className={styles.app}>
      <nav className={styles.tabsBar}>
        {themes.map((t) => {
          const count = spec.modules.filter((m) => m.theme === t).length;
          return (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${t === activeTheme ? styles.tabOn : ""}`}
              onClick={() => setTheme(t)}
            >
              {t}
              <span className={styles.tabCount}>{count}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.canvas}>
        {visible.length || building ? (
          <div className={styles.grid}>
            {visible.map((m) => (
              <ModuleCard key={m.id} module={m} fresh={freshIds.includes(m.id)} state={state} />
            ))}
            {building ? <SkeletonCard /> : null}
          </div>
        ) : (
          <div className={styles.emptyTheme}>Aucun module dans cet onglet pour l&apos;instant.</div>
        )}
      </div>
    </div>
  );
}
