import type { Artefact } from "@/lib/types";
import type { AppBlock } from "@/lib/appPreview";
import { inferArtefactKind } from "@/lib/artefactKind";
import type { CalloutTone, DashboardBlock, DashboardSpec, KvItem } from "@/lib/dashboardArtefact";

/**
 * Les rapports « nouveaux » (tableaux de bord) sont déjà des blocs typés.
 * Les anciens (HTML `.gendoc` / markdown) passent par cet adaptateur pour
 * s'afficher avec le même langage visuel — sans casser les données déjà
 * enregistrées.
 */

const FULL = "full" as const;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function htmlToMarkdown(html: string): string {
  const converted = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(converted.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim());
}

function looksLikeHtml(raw: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(raw);
}

function classList(attrs: string): string {
  const m = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);
  return m ? ` ${m[1]} ` : " ";
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? m[1] : "";
}

function isMutedParagraph(attrs: string, text: string): boolean {
  const style = attr(attrs, "style").toLowerCase();
  const cls = classList(attrs).toLowerCase();
  if (cls.includes(" muted ") || cls.includes(" footnote ") || cls.includes(" disclaimer ")) return true;
  if (style.includes("var(--muted)") || style.includes("font-size:12") || style.includes("font-size: 12")) return true;
  const t = text.toLowerCase();
  return (
    t.startsWith("document de ") ||
    t.startsWith("définitions simplifiées") ||
    t.startsWith("aucune réservation") ||
    t.startsWith("liste générale") ||
    t.includes("ne constitue pas")
  );
}

function findClose(html: string, tag: string, from: number): number {
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  const closeRe = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 1;
  let i = from;
  while (i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const open = openRe.exec(html);
    const close = closeRe.exec(html);
    if (!close) return -1;
    if (open && open.index < close.index) {
      depth++;
      i = open.index + open[0].length;
    } else {
      depth--;
      if (depth === 0) return close.index;
      i = close.index + close[0].length;
    }
  }
  return -1;
}

interface HtmlBlock {
  tag: string;
  attrs: string;
  inner: string;
}

function nextHtmlBlock(html: string, from: number): { block: HtmlBlock; end: number } | null {
  const re = /<(h[1-6]|p|ul|ol|table|blockquote|div|hr)(\s[^>]*)?(\/?)>/gi;
  re.lastIndex = from;
  const open = re.exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  const attrs = open[2] ?? "";
  const selfClosing = open[3] === "/" || tag === "hr";
  if (selfClosing) {
    return { block: { tag, attrs, inner: "" }, end: open.index + open[0].length };
  }
  const innerStart = open.index + open[0].length;
  const closeAt = findClose(html, tag, innerStart);
  if (closeAt < 0) {
    return { block: { tag, attrs, inner: html.slice(innerStart) }, end: html.length };
  }
  return {
    block: { tag, attrs, inner: html.slice(innerStart, closeAt) },
    end: closeAt + tag.length + 3,
  };
}

function parseRow(inner: string): KvItem | null {
  const span = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
  const strong = inner.match(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/i);
  const label = stripTags(span?.[1] ?? "");
  const value = stripTags(strong?.[1] ?? "");
  if (label && value) return { label, value };
  const parts = stripTags(inner).split(/\s{2,}/);
  if (parts.length >= 2) return { label: parts[0]!, value: parts.slice(1).join(" ") };
  return null;
}

function splitLead(text: string): KvItem | null {
  const m = text.match(/^(.{1,80}?)(?:\s*[.：:]\s+|\s+[—–\-]\s+)(.{3,})$/);
  if (!m) return null;
  const label = m[1]!.replace(/\s+/g, " ").trim();
  const value = m[2]!.replace(/\s+/g, " ").trim();
  if (!label || !value) return null;
  return { label, value };
}

function parseListItems(inner: string): string[] {
  const items: string[] = [];
  const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) items.push(m[1] ?? "");
  return items;
}

function listToBlock(inner: string): DashboardBlock | null {
  const rawItems = parseListItems(inner);
  if (!rawItems.length) return null;

  const kvFromBold = rawItems.map((item) => {
    const lead = item.match(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>\s*([\s\S]*)$/i);
    if (!lead) return null;
    const label = stripTags(lead[1] ?? "").replace(/[.:]\s*$/, "");
    const value = stripTags(lead[2] ?? "");
    return label && value ? { label, value } : null;
  });
  if (kvFromBold.every((x): x is KvItem => x !== null) && kvFromBold.length >= 2) {
    return { type: "kv", width: FULL, items: kvFromBold };
  }

  const texts = rawItems.map((item) => stripTags(item)).filter(Boolean);
  const kvFromDash = texts.map(splitLead);
  if (kvFromDash.every((x): x is KvItem => x !== null) && kvFromDash.length >= 2) {
    return { type: "kv", width: FULL, items: kvFromDash };
  }

  const body = texts.map((t) => `- ${t}`).join("\n");
  return body ? { type: "text", width: FULL, body } : null;
}

function parseTable(inner: string): DashboardBlock | null {
  const headerCells = [...inner.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => stripTags(m[1] ?? ""));
  const rowHtml = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1] ?? "");
  const rows: string[][] = [];
  for (const row of rowHtml) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1] ?? ""));
    if (!cells.length) continue;
    if (headerCells.length && cells.join() === headerCells.join()) continue;
    rows.push(cells);
  }
  const columns =
    headerCells.filter(Boolean).length > 0
      ? headerCells
      : rows[0]
        ? rows[0].map((_, i) => (i === 0 ? " " : `Col. ${i + 1}`))
        : [];
  if (!columns.length || !rows.length) return null;
  return {
    type: "table",
    width: FULL,
    columns: columns.map((c) => c || " "),
    rows: rows.map((r) => columns.map((_, i) => r[i] ?? "")),
  };
}

function flushKv(rows: KvItem[], into: DashboardBlock[]) {
  if (!rows.length) return;
  into.push({ type: "kv", width: FULL, items: rows.splice(0, rows.length) });
}

function htmlToBlocks(html: string): DashboardBlock[] {
  const blocks: DashboardBlock[] = [];
  const pendingKv: KvItem[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const next = nextHtmlBlock(html, cursor);
    if (!next) {
      const leftover = stripTags(html.slice(cursor));
      if (leftover) {
        flushKv(pendingKv, blocks);
        blocks.push({ type: "text", width: FULL, body: leftover.slice(0, 4000) });
      }
      break;
    }
    if (next.block.tag !== "div" || !classList(next.block.attrs).includes(" row ")) {
      flushKv(pendingKv, blocks);
    }

    const { tag, attrs, inner } = next.block;
    if (tag === "hr") {
      cursor = next.end;
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      const text = stripTags(inner).slice(0, 120);
      if (text) blocks.push({ type: "heading", width: FULL, text });
    } else if (tag === "div" && classList(attrs).includes(" row ")) {
      const row = parseRow(inner);
      if (row) pendingKv.push(row);
    } else if (tag === "ul" || tag === "ol") {
      const block = listToBlock(inner);
      if (block) blocks.push(block);
    } else if (tag === "table") {
      const block = parseTable(inner);
      if (block) blocks.push(block);
    } else if (tag === "blockquote") {
      const body = htmlToMarkdown(inner).slice(0, 1500);
      if (body) blocks.push({ type: "callout", width: FULL, tone: "info" as CalloutTone, body });
    } else if (tag === "p") {
      const text = stripTags(inner);
      if (text) {
        if (isMutedParagraph(attrs, text)) {
          blocks.push({ type: "callout", width: FULL, tone: "neutral", body: text.slice(0, 1500) });
        } else {
          const md = htmlToMarkdown(inner).slice(0, 4000);
          if (md) blocks.push({ type: "text", width: FULL, body: md });
        }
      }
    } else if (tag === "div") {
      const nested = htmlToBlocks(inner);
      if (nested.length) blocks.push(...nested);
      else {
        const text = stripTags(inner);
        if (text) blocks.push({ type: "text", width: FULL, body: text.slice(0, 4000) });
      }
    }
    cursor = next.end;
  }
  flushKv(pendingKv, blocks);
  return mergeAdjacentText(blocks);
}

function mergeAdjacentText(blocks: DashboardBlock[]): DashboardBlock[] {
  const out: DashboardBlock[] = [];
  for (const block of blocks) {
    const prev = out[out.length - 1];
    if (block.type === "text" && prev?.type === "text") {
      const joined = `${prev.body}\n\n${block.body}`;
      out[out.length - 1] = { ...prev, body: joined.slice(0, 8000) };
    } else {
      out.push(block);
    }
  }
  return out;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

/** Markdown brut (rapport pas encore passé en HTML). */
function markdownToBlocks(md: string): DashboardBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: DashboardBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", width: FULL, text: heading[2]!.trim().slice(0, 120) });
      i++;
      continue;
    }
    if (line.trim().startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        quote.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      const body = quote.join(" ").trim();
      if (body) blocks.push({ type: "callout", width: FULL, tone: "info", body: body.slice(0, 1500) });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i] ?? "") || /^\s*\d+\.\s+/.test(lines[i] ?? ""))) {
        items.push((lines[i] ?? "").replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim());
        i++;
      }
      const kv = items.map(splitLead);
      if (kv.every((x): x is KvItem => x !== null) && kv.length >= 2) {
        blocks.push({ type: "kv", width: FULL, items: kv });
      } else {
        blocks.push({ type: "text", width: FULL, body: items.map((t) => `- ${t}`).join("\n") });
      }
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? "")) {
      const columns = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").includes("|") && !isTableSeparator(lines[i] ?? "")) {
        rows.push(splitTableRow(lines[i] ?? ""));
        i++;
      }
      if (columns.length && rows.length) {
        blocks.push({
          type: "table",
          width: FULL,
          columns,
          rows: rows.map((r) => columns.map((_, ci) => r[ci] ?? "")),
        });
      }
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,4})\s+/.test(lines[i] ?? "") &&
      !(lines[i] ?? "").trim().startsWith(">") &&
      !/^\s*[-*+]\s+/.test(lines[i] ?? "") &&
      !(lines[i] ?? "").includes("|")
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    const body = para.join(" ").trim();
    if (body) blocks.push({ type: "text", width: FULL, body: body.slice(0, 4000) });
  }
  return mergeAdjacentText(blocks);
}

function finalizeBlocks(blocks: DashboardBlock[], fallback: string): DashboardSpec | null {
  const sliced = blocks.slice(0, 24);
  if (sliced.length) return { blocks: sliced };
  const text = fallback.slice(0, 4000).trim();
  if (!text) return null;
  return { blocks: [{ type: "text", width: FULL, body: text }] };
}

/** Convertit un corps de rapport (HTML historique ou markdown) en blocs du design actuel. */
export function bodyToReportSpec(body: string): DashboardSpec | null {
  const raw = body.trim();
  if (!raw) return null;
  if (looksLikeHtml(raw)) {
    return finalizeBlocks(htmlToBlocks(raw), stripTags(raw));
  }
  return finalizeBlocks(markdownToBlocks(raw), raw);
}

/** Rapport affiché comme du texte HTML (pas un dashboard / image / profil). */
export function hasReportBody(artefact: Artefact): boolean {
  if (!artefact.body?.trim()) return false;
  if (artefact.dashboard || artefact.imageUrl || artefact.profileSummary) return false;
  return inferArtefactKind(artefact) === "report";
}

export function reportSpecFromArtefact(artefact: Artefact): DashboardSpec | null {
  if (!hasReportBody(artefact) || !artefact.body) return null;
  return bodyToReportSpec(artefact.body);
}

export function reportSpecToAppBlocks(spec: DashboardSpec): AppBlock[] {
  const blocks: AppBlock[] = [];
  for (const b of spec.blocks) {
    switch (b.type) {
      case "heading":
        blocks.push({ kind: "heading", text: b.text });
        break;
      case "text":
        blocks.push({ kind: "text", text: b.body.slice(0, 1200) });
        break;
      case "callout":
        blocks.push({
          kind: "callout",
          tone: b.tone === "warning" ? "warning" : b.tone === "success" ? "success" : "info",
          title: b.title,
          text: b.body.slice(0, 600),
        });
        break;
      case "kv":
        blocks.push({
          kind: "table",
          columns: ["", ""],
          rows: b.items.slice(0, 20).map((i) => [i.label, i.value]),
        });
        break;
      case "table":
        blocks.push({ kind: "table", columns: b.columns, rows: b.rows });
        break;
      case "stats":
        blocks.push({
          kind: "stats",
          items: b.items.slice(0, 4).map((i) => ({
            value: i.value,
            label: i.label,
            delta: i.delta,
            dir: i.trend === "up" || i.trend === "down" ? i.trend : undefined,
          })),
        });
        break;
      default:
        break;
    }
  }
  return blocks;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HTML e-mail calqué sur le design tableau de bord (styles inline). */
export function reportSpecToEmailHtml(spec: DashboardSpec, title: string): string {
  const parts: string[] = [
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#15212b;line-height:1.55">`,
    `<h2 style="font-size:20px;letter-spacing:-0.02em;margin:0 0 18px">${escapeHtml(title)}</h2>`,
  ];
  for (const b of spec.blocks) {
    switch (b.type) {
      case "heading":
        parts.push(
          `<h3 style="font-size:15px;margin:18px 0 8px;padding-left:10px;border-left:4px solid #5b8f86">${escapeHtml(b.text)}</h3>`
        );
        break;
      case "text":
        parts.push(
          `<p style="margin:0 0 12px;font-size:14px">${escapeHtml(b.body).replace(/\n\n/g, "</p><p style=\"margin:0 0 12px;font-size:14px\">").replace(/\n/g, "<br>")}</p>`
        );
        break;
      case "callout":
        parts.push(
          `<div style="margin:12px 0;padding:12px 14px;border-radius:12px;background:#f4f7f6;border:1px solid #d5e0dc;font-size:13px">${
            b.title ? `<strong style="display:block;margin-bottom:4px">${escapeHtml(b.title)}</strong>` : ""
          }${escapeHtml(b.body)}</div>`
        );
        break;
      case "kv":
        parts.push(`<table style="width:100%;border-collapse:collapse;margin:8px 0 14px">`);
        for (const item of b.items) {
          parts.push(
            `<tr><td style="padding:8px 12px 8px 0;color:#5c6b73;font-size:13px;width:40%;border-bottom:1px solid #e6eeeb">${escapeHtml(item.label)}</td><td style="padding:8px 0;font-size:13px;border-bottom:1px solid #e6eeeb">${escapeHtml(item.value)}</td></tr>`
          );
        }
        parts.push(`</table>`);
        break;
      case "table":
        parts.push(`<table style="width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13px"><thead><tr>`);
        for (const c of b.columns) {
          parts.push(
            `<th style="text-align:left;padding:8px 10px;border-bottom:2px solid #d5e0dc;color:#5b8f86;font-size:11px;text-transform:uppercase">${escapeHtml(c)}</th>`
          );
        }
        parts.push(`</tr></thead><tbody>`);
        for (const row of b.rows) {
          parts.push(`<tr>`);
          for (const cell of row) {
            parts.push(`<td style="padding:8px 10px;border-bottom:1px solid #e6eeeb">${escapeHtml(cell)}</td>`);
          }
          parts.push(`</tr>`);
        }
        parts.push(`</tbody></table>`);
        break;
      case "stats":
        parts.push(`<table style="width:100%;margin:8px 0 14px"><tr>`);
        for (const s of b.items) {
          parts.push(
            `<td style="padding:10px 12px;background:#f4f7f6;border-radius:10px"><div style="font-size:11px;color:#5c6b73;text-transform:uppercase">${escapeHtml(s.label)}</div><div style="font-size:20px;font-weight:700">${escapeHtml(s.value)}</div></td>`
          );
        }
        parts.push(`</tr></table>`);
        break;
      default:
        break;
    }
  }
  parts.push(`<p style="margin-top:24px;font-size:12px;color:#8888a0">Généré par Getgents</p></div>`);
  return parts.join("");
}
