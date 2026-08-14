import type { Artefact } from "@/lib/types";
import type { DashboardBlock, DashboardSpec } from "@/lib/dashboardArtefact";
import { bodyToReportSpec } from "@/lib/reportArtefact";
import { ARTEFACT_KIND_META, WORKSPACE_ARTEFACT_KINDS, type WorkspaceArtefactKind } from "@/lib/artefactKind";

/**
 * Changer le TYPE d'un artefact doit changer sa STRUCTURE.
 *
 * Le sélecteur de type ne faisait que réécrire le libellé, l'icône et le
 * champ `kind` : le contenu restait tel quel, si bien qu'un rapport « passé
 * en checklist » restait un pavé de texte simplement rangé sous un autre
 * onglet. Ce module convertit réellement la charge utile — et n'offre que
 * les types réellement atteignables depuis le contenu présent, plutôt que
 * de promettre une conversion impossible (on ne fabrique pas des
 * coordonnées géographiques à partir d'un rapport).
 *
 * `body` n'est jamais effacé : c'est la source, et le garder rend les
 * conversions réversibles. Ce sont les charges structurées concurrentes
 * qui sont nettoyées, sans quoi la tuile empilerait l'ancienne et la
 * nouvelle.
 */

/** Contenu d'un artefact ramené à une matière commune, indépendante du type. */
export interface ArtefactMatter {
  /** Lignes de texte : titres, paragraphes, éléments de liste. */
  lines: string[];
  /** Couples étiquette/valeur : kv, stats, tableaux à deux colonnes. */
  pairs: { label: string; value: string }[];
  /** Couples dont la valeur est chiffrée — matière d'un graphique. */
  numbers: { label: string; value: number }[];
  /** Lignes qui étaient déjà des éléments de liste — matière d'une checklist. */
  bullets: string[];
}

/** Spécification de blocs disponible : celle du tableau de bord, ou celle tirée du corps. */
export function artefactSpec(artefact: Artefact): DashboardSpec | null {
  if (artefact.dashboard?.blocks?.length) return artefact.dashboard;
  return artefact.body ? bodyToReportSpec(artefact.body) : null;
}

/** « 685 000 € », « -2,1 % », « 12 » → nombre ; « élevé » → null. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/\s| | /g, "")
    .replace(/[€$%]/g, "")
    .replace(",", ".");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function artefactMatter(artefact: Artefact): ArtefactMatter {
  const lines: string[] = [];
  const bullets: string[] = [];
  const pairs: { label: string; value: string }[] = [];
  const numbers: { label: string; value: number }[] = [];

  const push = (label: string, value: string) => {
    if (!label.trim() || !value.trim()) return;
    pairs.push({ label: label.trim(), value: value.trim() });
    const n = parseNumber(value);
    if (n !== null) numbers.push({ label: label.trim(), value: n });
  };

  for (const b of artefactSpec(artefact)?.blocks ?? []) {
    switch (b.type) {
      case "heading":
        lines.push(b.text);
        break;
      case "text":
        for (const raw of b.body.split(/\n+/)) {
          const line = raw.trim();
          if (!line) continue;
          // Le marqueur de liste est une notation, pas du texte : le garder
          // faisait apparaître « - Sentier bleu » à côté d'une case à cocher.
          const item = line.replace(/^(?:[-*+]|\d+\.)\s+/, "");
          if (item !== line) bullets.push(item);
          lines.push(item);
        }
        break;
      case "callout":
        lines.push([b.title, b.body].filter(Boolean).join(" — "));
        break;
      case "kv":
        for (const i of b.items) push(i.label, i.value);
        break;
      case "stats":
        for (const i of b.items) push(i.label, i.value);
        break;
      case "table":
        for (const row of b.rows) {
          if (row.length >= 2) push(row[0], row[1]);
          else if (row[0]) lines.push(row[0]);
        }
        break;
      case "chart":
        for (const row of b.data) {
          const label = String(row[b.xKey ?? "name"] ?? "");
          const key = b.series[0]?.key;
          const value = key === undefined ? null : parseNumber(String(row[key] ?? ""));
          if (label && value !== null) {
            numbers.push({ label, value });
            pairs.push({ label, value: String(row[key!]) });
          }
        }
        break;
    }
  }

  for (const i of artefact.checklistItems ?? []) {
    lines.push(i.label);
    bullets.push(i.label);
  }
  for (const d of artefact.chartData ?? []) {
    numbers.push({ label: d.label, value: d.value });
    pairs.push({ label: d.label, value: String(d.value) });
  }
  for (const p of artefact.mapPoints ?? []) lines.push(p.label);
  const profile = artefact.profileSummary;
  if (profile) {
    lines.push(profile.name);
    if (profile.headline) lines.push(profile.headline);
    if (profile.summary) lines.push(profile.summary);
    for (const h of profile.highlights ?? []) lines.push(h);
  }
  if (artefact.imageCaption) lines.push(artefact.imageCaption);

  return {
    lines: lines.filter(Boolean).slice(0, 60),
    bullets: bullets.filter(Boolean).slice(0, 30),
    pairs: pairs.slice(0, 40),
    numbers: numbers.slice(0, 24),
  };
}

/**
 * Types atteignables depuis le contenu présent. Un rapport peut devenir
 * checklist ou tableau de bord ; il ne peut pas devenir une carte, faute de
 * coordonnées, ni une image, faute d'illustration. Le sélecteur n'affiche
 * donc que ce qui tient debout.
 */
export function convertibleKinds(artefact: Artefact): WorkspaceArtefactKind[] {
  const matter = artefactMatter(artefact);
  const has = {
    text: matter.lines.length > 0 || matter.pairs.length > 0,
    numbers: matter.numbers.length > 0,
    map: (artefact.mapPoints?.length ?? 0) > 0,
    profile: !!artefact.profileSummary,
    image: !!artefact.imageUrl,
  };
  return WORKSPACE_ARTEFACT_KINDS.filter((k) => {
    switch (k) {
      case "report":
      case "visual":
        return has.text || has.image;
      case "checklist":
        return has.text;
      case "chart":
        return has.numbers;
      case "dashboard":
        return has.text || has.numbers;
      case "map":
        return has.map;
      case "profile-summary":
        return has.profile;
      case "image":
        return has.image;
    }
  });
}

function matterToMarkdown(artefact: Artefact, matter: ArtefactMatter): string {
  const out: string[] = [];
  if (matter.lines.length) out.push(matter.lines.join("\n\n"));
  if (matter.pairs.length) {
    out.push(matter.pairs.map((p) => `- **${p.label}** : ${p.value}`).join("\n"));
  }
  return out.join("\n\n").trim() || artefact.title;
}

function matterToDashboard(artefact: Artefact, matter: ArtefactMatter): DashboardSpec {
  const existing = artefactSpec(artefact);
  if (existing?.blocks.length) return existing;
  const blocks: DashboardBlock[] = [];
  if (matter.pairs.length) {
    blocks.push({
      type: "stats",
      width: "full",
      items: matter.pairs.slice(0, 4).map((p) => ({ label: p.label, value: p.value })),
    });
  }
  if (matter.pairs.length > 4) {
    blocks.push({ type: "kv", width: "full", items: matter.pairs.slice(4, 20) });
  }
  if (matter.lines.length) {
    blocks.push({ type: "text", width: "full", body: matter.lines.slice(0, 12).join("\n\n") });
  }
  return { blocks: blocks.length ? blocks : [{ type: "text", width: "full", body: artefact.title }] };
}

/** Champs structurés remis à zéro avant d'installer celui du type visé. */
const STRUCTURED: (keyof Artefact)[] = [
  "checklistItems",
  "chartData",
  "mapPoints",
  "dashboard",
  "profileSummary",
  "visual",
];

/**
 * Convertit réellement l'artefact vers un type : libellé, icône, `kind` ET
 * charge utile. Un type non atteignable est laissé tel quel plutôt que
 * produit vide.
 */
export function convertArtefactToKind(artefact: Artefact, kind: WorkspaceArtefactKind): Artefact {
  const meta = ARTEFACT_KIND_META[kind];
  const matter = artefactMatter(artefact);

  const base: Artefact = { ...artefact, kind, type: meta.type, icon: meta.icon };
  // Les charges concurrentes sont retirées : sans ça, la tuile empilerait
  // l'ancienne structure sous la nouvelle.
  for (const field of STRUCTURED) delete (base as unknown as Record<string, unknown>)[field as string];

  switch (kind) {
    case "report":
      return { ...base, body: artefact.body?.trim() ? artefact.body : matterToMarkdown(artefact, matter) };

    case "checklist": {
      const items = (artefact.checklistItems ?? []).length
        ? artefact.checklistItems!
        : (matter.bullets.length >= 2
            ? // Le document contient déjà une liste : c'est elle la checklist,
              // pas l'intégralité de la prose qui l'entoure.
              matter.bullets.map((l) => ({ label: l.slice(0, 160), checked: false }))
            : [
                ...matter.pairs.map((p) => ({ label: `${p.label} : ${p.value}`, checked: false })),
                ...matter.lines.map((l) => ({ label: l.slice(0, 160), checked: false })),
              ]
          ).slice(0, 20);
      return items.length ? { ...base, checklistItems: items } : artefact;
    }

    case "chart": {
      const data = (artefact.chartData ?? []).length ? artefact.chartData! : matter.numbers.slice(0, 12);
      return data.length ? { ...base, chartData: data } : artefact;
    }

    case "dashboard":
      return { ...base, dashboard: matterToDashboard(artefact, matter) };

    case "map":
      return artefact.mapPoints?.length ? { ...base, mapPoints: artefact.mapPoints } : artefact;

    case "profile-summary":
      return artefact.profileSummary ? { ...base, profileSummary: artefact.profileSummary } : artefact;

    case "image":
      return artefact.imageUrl ? { ...base } : artefact;

    case "visual":
      return { ...base, visual: true, body: artefact.body ?? matterToMarkdown(artefact, matter) };
  }
}
