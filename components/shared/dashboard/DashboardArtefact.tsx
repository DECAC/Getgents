"use client";

import { useEffect, useState } from "react";
import { dureeDeLaPlage } from "@/lib/friseDuree";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SafeHTMLDoc } from "@/components/shared/SafeHTML";
import { renderMarkdown } from "@/lib/markdown";
import {
  CHART_CATEGORICAL,
  type DashboardSpec,
  type DashboardBlock,
  type ChartSeries,
  type CalloutTone,
} from "@/lib/dashboardArtefact";
import styles from "./DashboardArtefact.module.css";

const NUM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

const AXIS = { fontSize: 11, fill: "var(--muted)" };

function fmt(v: unknown): string {
  return typeof v === "number" ? NUM.format(v) : String(v ?? "");
}

/** Infobulle stylée aux tokens du produit (jamais la couleur de série pour le texte). */
function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: readonly { name?: string; value?: unknown; color?: string; payload?: Record<string, unknown> }[]; label?: unknown; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      {label !== undefined && label !== "" && <div className={styles.tooltipLabel}>{String(label)}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <span className={styles.tooltipVal}>
            {fmt(p.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function seriesColor(i: number): string {
  return CHART_CATEGORICAL[i % CHART_CATEGORICAL.length];
}

function ChartBlock({ block }: { block: Extract<DashboardBlock, { type: "chart" }> }) {
  const { variant, data, series, xKey = "label", unit, stacked, title } = block;
  const height = 240;

  const grid = <CartesianGrid stroke="var(--line-soft)" vertical={false} />;
  const xAxis = <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} minTickGap={4} />;
  const yAxis = <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => NUM.format(Number(v))} />;
  const tip = <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--line-soft)" }} />;
  const legend =
    series.length >= 2 || variant === "pie" || variant === "donut" ? (
      <Legend wrapperStyle={{ fontSize: 11.5, color: "var(--muted)" }} iconType="circle" iconSize={9} />
    ) : null;

  if (variant === "pie" || variant === "donut") {
    const key = series[0]?.key ?? "value";
    return (
      <ChartFrame title={title}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey={key}
              nameKey={xKey}
              innerRadius={variant === "donut" ? 58 : 0}
              outerRadius={88}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              label={(e: { name?: unknown; value?: unknown }) => `${e.name}`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={seriesColor(i)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Legend wrapperStyle={{ fontSize: 11.5, color: "var(--muted)" }} iconType="circle" iconSize={9} />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
    );
  }

  const renderSeries = (s: ChartSeries, i: number) => {
    const t = variant === "composed" ? s.type ?? "bar" : variant;
    const color = seriesColor(i);
    if (t === "line")
      return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} />;
    if (t === "area")
      return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.16} stackId={stacked ? "s" : undefined} />;
    return <Bar key={s.key} dataKey={s.key} name={s.label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={38} stackId={stacked ? "s" : undefined} />;
  };

  const Comp = variant === "line" ? LineChart : variant === "area" ? AreaChart : variant === "composed" ? ComposedChart : BarChart;

  return (
    <ChartFrame title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <Comp data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {xAxis}
          {yAxis}
          {tip}
          {legend}
          {series.map(renderSeries)}
        </Comp>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ChartFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      {title && <h4 className={styles.cardTitle}>{title}</h4>}
      {children}
    </div>
  );
}

const TREND_ICON: Record<string, string> = { up: "▲", down: "▼", flat: "→" };

function StatsBlock({ items }: { items: Extract<DashboardBlock, { type: "stats" }>["items"] }) {
  return (
    <div className={styles.statsRow}>
      {items.map((s, i) => (
        <div key={i} className={styles.stat}>
          <div className={styles.statLabel}>{s.label}</div>
          <div className={styles.statValue}>{s.value}</div>
          <div className={styles.statFoot}>
            {s.delta && (
              <span className={[styles.statDelta, s.trend ? styles[`trend-${s.trend}`] : ""].filter(Boolean).join(" ")}>
                {s.trend && TREND_ICON[s.trend]} {s.delta}
              </span>
            )}
            {s.hint && <span className={styles.statHint}>{s.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const TONE_ICON: Record<CalloutTone, string> = { info: "ℹ", success: "✓", warning: "⚠", critical: "✕", neutral: "•" };

function CalloutBlock({ block }: { block: Extract<DashboardBlock, { type: "callout" }> }) {
  return (
    <div className={[styles.callout, styles[`tone-${block.tone}`]].join(" ")}>
      <div className={styles.calloutIcon}>{TONE_ICON[block.tone]}</div>
      <div className={styles.calloutBody}>
        {block.title && <div className={styles.calloutTitle}>{block.title}</div>}
        <SafeHTMLDoc html={renderMarkdown(block.body)} />
      </div>
    </div>
  );
}

function KvBlock({ block }: { block: Extract<DashboardBlock, { type: "kv" }> }) {
  return (
    <div className={styles.card}>
      {block.title && <h4 className={styles.cardTitle}>{block.title}</h4>}
      <dl className={styles.kvGrid}>
        {block.items.map((it, i) => (
          <div key={i} className={styles.kvItem}>
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Frise chronologique — rail VERTICAL, jamais un bandeau horizontal.
 *
 * Le bandeau est la forme qu'on imagine d'abord, et il se casse sous 400 px :
 * intitulés chevauchés, ou défilement latéral sur une page qui ne défile
 * jamais latéralement. L'usage visé est majoritairement mobile. Le rail garde
 * la MÊME forme de 320 à 900 px — seule la date change de place. Un seul
 * rendu à écrire, aucune bascule à déboguer.
 */
function TimelineBlock({ block }: { block: Extract<DashboardBlock, { type: "timeline" }> }) {
  // L'année n'est lue qu'ici, au rendu : `dureeDeLaPlage` reste pure et
  // testable, et ne change pas de résultat au 1er janvier.
  const anneeCourante = new Date().getFullYear();

  return (
    <div className={styles.card}>
      {block.title && <h4 className={styles.cardTitle}>{block.title}</h4>}
      <ol className={[styles.frise, block.items.some((i) => i.date) ? "" : styles.friseSansDates].filter(Boolean).join(" ")}>
        {block.items.map((it, i) => {
          const duree = it.date ? dureeDeLaPlage(it.date, anneeCourante) : null;
          return (
            <li key={i} className={[styles.etape, styles[it.state]].filter(Boolean).join(" ")}>
              {/* Etape non datee : la gouttiere disparait plutot que de rester
                  vide, et le contenu regagne la place. Le rail, lui, ne bouge
                  pas — c'est lui qui tient l'alignement. */}
              <div className={[styles.quand, it.date ? "" : styles.sansDate].filter(Boolean).join(" ")}>
                {it.date}
                {duree && <span className={styles.duree}>{duree}</span>}
              </div>
              <div className={styles.rail} aria-hidden="true">
                <span className={styles.noeud} />
              </div>
              <div className={styles.friseContenu}>
                <div className={styles.friseEntete}>
                  <span className={styles.intitule}>{it.label}</span>
                  {it.tag && <span className={styles.puce}>{it.tag}</span>}
                  {it.metric && <span className={styles.mesure}>{it.metric}</span>}
                </div>
                {it.body && <p className={styles.friseCorps}>{it.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {/* Un état tronqué sans un mot est le piège déjà payé ici : on le dit. */}
      {block.omises ? (
        <p className={styles.friseOmises}>
          {block.omises} étape{block.omises > 1 ? "s" : ""} supplémentaire
          {block.omises > 1 ? "s" : ""} non affichée{block.omises > 1 ? "s" : ""} — la frise
          en montre {block.items.length} au maximum.
        </p>
      ) : null}
    </div>
  );
}

function TableBlock({ block }: { block: Extract<DashboardBlock, { type: "table" }> }) {
  return (
    <div className={styles.card}>
      {block.title && <h4 className={styles.cardTitle}>{block.title}</h4>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>{block.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Block({ block }: { block: DashboardBlock }) {
  switch (block.type) {
    case "stats":
      return <StatsBlock items={block.items} />;
    case "heading":
      return <h3 className={styles.heading}>{block.text}</h3>;
    case "text":
      return (
        <div className={styles.textBlock}>
          <SafeHTMLDoc html={renderMarkdown(block.body)} />
        </div>
      );
    case "callout":
      return <CalloutBlock block={block} />;
    case "kv":
      return <KvBlock block={block} />;
    case "timeline":
      return <TimelineBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "chart":
      return <ChartBlock block={block} />;
    default:
      return null;
  }
}

/** Un bloc occupe toute la largeur, sauf charts/kv en "half" (deux colonnes). */
function blockSpan(block: DashboardBlock): "full" | "half" {
  if (block.type === "stats" || block.type === "heading") return "full";
  if (block.width) return block.width;
  return block.type === "chart" || block.type === "kv" ? "half" : "full";
}

export function DashboardArtefact({ spec }: { spec: DashboardSpec }) {
  // Recharts (ResponsiveContainer) a besoin du DOM : on ne rend qu'après le
  // montage client pour éviter les avertissements de largeur nulle en SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={styles.dashboard}>
      {spec.subtitle && <p className={styles.subtitle}>{spec.subtitle}</p>}
      <div className={styles.grid}>
        {spec.blocks.map((block, i) => {
          const span = blockSpan(block) === "half" ? styles.spanHalf : styles.spanFull;
          if (block.type === "chart" && !mounted) {
            return <div key={i} className={[span, styles.chartSkeleton].join(" ")} />;
          }
          return (
            <div key={i} className={span}>
              <Block block={block} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
