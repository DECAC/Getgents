import type { AppBlock, AppModuleSpec, AppPreviewSpec } from "@/lib/appPreview";
import type { Artefact } from "@/lib/types";
import { inferArtefactKind } from "@/lib/artefactKind";
import { hasReportBody, reportSpecFromArtefact, reportSpecToAppBlocks, reportSpecToEmailHtml } from "@/lib/reportArtefact";

/** Id de module dans l'aperçu d'espace — distinct des modules studio. */
export function keptArtefactModuleId(artefactId: string): string {
  return `artef-${artefactId}`;
}

export function isKeptArtefactModuleId(moduleId: string): boolean {
  return moduleId.startsWith("artef-");
}

export function artefactIdFromModuleId(moduleId: string): string | null {
  if (!isKeptArtefactModuleId(moduleId)) return null;
  return moduleId.slice("artef-".length) || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function artefactToBlocks(artefact: Artefact): AppBlock[] {
  const blocks: AppBlock[] = [];
  const reportSpec = hasReportBody(artefact) ? reportSpecFromArtefact(artefact) : null;
  if (reportSpec) {
    blocks.push(...reportSpecToAppBlocks(reportSpec));
  } else if (artefact.body) {
    const text = stripHtml(artefact.body);
    if (text) blocks.push({ kind: "text", text: text.slice(0, 800) });
  }
  if (artefact.checklistItems?.length) {
    blocks.push({
      kind: "checklist",
      items: artefact.checklistItems.slice(0, 20).map((i) => ({ label: i.label, done: i.checked })),
    });
  }
  if (artefact.chartData?.length) {
    blocks.push({
      kind: "chart",
      caption: artefact.title,
      series: artefact.chartData.slice(0, 12).map((d) => ({ label: d.label, value: d.value })),
    });
  }
  if (artefact.mapPoints?.length) {
    blocks.push({
      kind: "table",
      columns: ["Lieu", "Latitude", "Longitude"],
      numeric: [1, 2],
      rows: artefact.mapPoints.slice(0, 12).map((p) => [p.label, String(p.lat), String(p.lon)]),
    });
  }
  if (artefact.profileSummary) {
    const s = artefact.profileSummary;
    blocks.push({
      kind: "profile",
      initials: s.name.slice(0, 2).toUpperCase(),
      name: s.name,
      headline: s.headline ?? artefact.title,
      facts: (s.experience ?? []).slice(0, 4).map((e) => ({
        value: e.period ?? "",
        label: [e.title, e.org].filter(Boolean).join(" · "),
      })),
      chips: (s.skills ?? []).slice(0, 8),
    });
  }
  if (artefact.dashboard?.blocks?.length) {
    const heading = artefact.dashboard.blocks.find((b) => b.type === "heading");
    if (heading && heading.type === "heading") blocks.push({ kind: "heading", text: heading.text });
    const stats = artefact.dashboard.blocks.find((b) => b.type === "stats");
    if (stats && stats.type === "stats") {
      blocks.push({
        kind: "stats",
        items: stats.items.slice(0, 4).map((i) => ({
          value: i.value,
          label: i.label,
          delta: i.delta,
          dir: i.trend === "up" || i.trend === "down" ? i.trend : undefined,
        })),
      });
    }
  }
  if (!blocks.length) {
    blocks.push({ kind: "text", text: artefact.title });
  }
  return blocks;
}

function artefactToModule(artefact: Artefact): AppModuleSpec {
  const kind = inferArtefactKind(artefact);
  const size =
    kind === "dashboard" || kind === "map" || kind === "profile-summary"
      ? "full"
      : kind === "chart" || kind === "visual" || kind === "image"
        ? "large"
        : "standard";
  return {
    id: keptArtefactModuleId(artefact.id),
    title: artefact.title,
    theme: artefact.type,
    size,
    source: artefact.type,
    blocks: artefactToBlocks(artefact),
  };
}

/**
 * Greffe les artefacts gardés sur l'aperçu d'application : chaque artefact
 * devient une tuile, rangée dans un onglet au nom de son type (Rapport,
 * Checklist…). Les onglets studio restent en tête.
 */
export function withKeptArtefacts(spec: AppPreviewSpec, artefacts: Artefact[]): AppPreviewSpec {
  const modules = artefacts.map(artefactToModule);
  if (!modules.length) return spec;
  const extraThemes: string[] = [];
  for (const m of modules) {
    if (!spec.themes.includes(m.theme) && !extraThemes.includes(m.theme)) extraThemes.push(m.theme);
  }
  return {
    ...spec,
    themes: [...spec.themes, ...extraThemes],
    modules: [...spec.modules, ...modules],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adresses séparées par virgule, point-virgule ou retour ligne. */
export function parseEmailRecipients(raw: string): { emails: string[]; invalid: string[] } {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (EMAIL_RE.test(p)) {
      if (!emails.includes(p)) emails.push(p);
    } else {
      invalid.push(p);
    }
  }
  return { emails, invalid };
}

export interface ArtefactSharePayload {
  subject: string;
  body: string;
  htmlBody?: string;
  imageUrl?: string;
}

/** Contenu de CET artefact seulement — jamais l'espace entier. */
export function artefactSharePayload(artefact: Artefact): ArtefactSharePayload {
  const lines: string[] = [artefact.title, artefact.type, ""];
  if (artefact.body) lines.push(stripHtml(artefact.body), "");
  if (artefact.checklistItems?.length) {
    lines.push("Checklist :");
    for (const item of artefact.checklistItems) {
      lines.push(`${item.checked ? "[x]" : "[ ]"} ${item.label}`);
    }
    lines.push("");
  }
  if (artefact.chartData?.length) {
    lines.push("Chiffres :");
    for (const d of artefact.chartData) lines.push(`- ${d.label} : ${d.value}`);
    lines.push("");
  }
  if (artefact.mapPoints?.length) {
    lines.push("Lieux :");
    for (const p of artefact.mapPoints) lines.push(`- ${p.label} (${p.lat}, ${p.lon})`);
    lines.push("");
  }
  if (artefact.profileSummary) {
    const s = artefact.profileSummary;
    lines.push(s.name);
    if (s.headline) lines.push(s.headline);
    if (s.summary) lines.push(s.summary);
    if (s.skills?.length) lines.push(s.skills.join(", "));
    for (const h of s.highlights ?? []) lines.push(`- ${h}`);
    lines.push("");
  }
  if (artefact.dashboard?.blocks?.length) {
    lines.push(artefact.dashboard.subtitle ?? "Tableau de bord");
    for (const b of artefact.dashboard.blocks) {
      if (b.type === "heading") lines.push(b.text);
      if (b.type === "stats") {
        for (const i of b.items) lines.push(`${i.label} : ${i.value}${i.delta ? ` (${i.delta})` : ""}`);
      }
      if (b.type === "kv") {
        for (const i of b.items) lines.push(`${i.label} : ${i.value}`);
      }
      if (b.type === "callout") lines.push(b.body);
    }
    lines.push("");
  }
  if (artefact.imageCaption) lines.push(artefact.imageCaption, "");
  const body = lines.join("\n").trim() || artefact.title;
  const reportSpec = hasReportBody(artefact) ? reportSpecFromArtefact(artefact) : null;
  return {
    subject: artefact.title,
    body,
    htmlBody: reportSpec ? reportSpecToEmailHtml(reportSpec, artefact.title) : artefact.body || undefined,
    imageUrl: artefact.imageUrl || undefined,
  };
}

export const GMAIL_NOT_CONNECTED_MESSAGE =
  "Gmail n'est pas connecté. Dans le studio, ouvrez l'onglet Connecteurs et cliquez sur « Connecter un compte Google ».";
