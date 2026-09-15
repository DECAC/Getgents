/**
 * Génère un PDF texte simple (Helvetica, A4) sans bibliothèque tierce.
 * Le fichier d'origine n'est pas conservé en binaire : on reconstitue un PDF
 * à partir du texte déjà extrait (y compris si la source était un PDF).
 */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const TITLE_SIZE = 14;
const BODY_SIZE = 11;
const LINE_H = 15;
const CHARS_PER_LINE = 86;

/** Correspondances Unicode → Windows-1252 (encodage WinAnsi du PDF). */
const WIN1252: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  ƒ: 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  ˆ: 0x88,
  "‰": 0x89,
  Š: 0x8a,
  "‹": 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  š: 0x9a,
  "›": 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
  "\u00a0": 0xa0,
};

function toWinAnsiByte(ch: string): number {
  const mapped = WIN1252[ch];
  if (mapped !== undefined) return mapped;
  const code = ch.charCodeAt(0);
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  if (ch === "\t") return 0x20;
  return 0x3f; // ?
}

function pdfLiteral(text: string): string {
  let out = "";
  for (const ch of text) {
    const b = toWinAnsiByte(ch);
    if (b === 0x5c) out += "\\\\";
    else if (b === 0x28) out += "\\(";
    else if (b === 0x29) out += "\\)";
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, "0")}`;
  }
  return out;
}

function wrapParagraph(paragraph: string): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= CHARS_PER_LINE) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= CHARS_PER_LINE) {
      current = word;
    } else {
      for (let i = 0; i < word.length; i += CHARS_PER_LINE) {
        const chunk = word.slice(i, i + CHARS_PER_LINE);
        if (i + CHARS_PER_LINE < word.length) lines.push(chunk);
        else current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapPdfText(text: string): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const p of paragraphs) {
    if (!p.trim()) {
      lines.push("");
      continue;
    }
    lines.push(...wrapParagraph(p));
  }
  return lines;
}

function pageContentStream(title: string, lines: string[], pageIndex: number, pageCount: number): string {
  const ops: string[] = ["BT", "/F1 14 Tf", "0.15 0.2 0.27 rg"];
  let y = PAGE_H - MARGIN;
  if (pageIndex === 0 && title.trim()) {
    ops.push(`/F1 ${TITLE_SIZE} Tf`);
    ops.push(`1 0 0 1 ${MARGIN} ${y} Tm`);
    ops.push(`(${pdfLiteral(title.trim().slice(0, CHARS_PER_LINE))}) Tj`);
    y -= LINE_H + 8;
    ops.push("0.75 0.78 0.8 RG 0.6 w");
    ops.push("ET");
    ops.push(`${MARGIN} ${y + 6} m ${PAGE_W - MARGIN} ${y + 6} l S`);
    ops.push("BT");
    ops.push("0.15 0.2 0.27 rg");
    y -= 6;
  }
  ops.push(`/F1 ${BODY_SIZE} Tf`);
  for (const line of lines) {
    ops.push(`1 0 0 1 ${MARGIN} ${y} Tm`);
    ops.push(`(${pdfLiteral(line)}) Tj`);
    y -= LINE_H;
  }
  ops.push("ET");
  const footer = `Page ${pageIndex + 1} / ${pageCount}`;
  ops.push("BT", "/F1 9 Tf", "0.55 0.58 0.6 rg");
  ops.push(`1 0 0 1 ${MARGIN} 28 Tm`);
  ops.push(`(${pdfLiteral(footer)}) Tj`);
  ops.push("ET");
  return ops.join("\n");
}

function linesPerFirstPage(hasTitle: boolean): number {
  const top = hasTitle ? MARGIN + LINE_H + 20 : MARGIN;
  return Math.max(1, Math.floor((PAGE_H - top - 40) / LINE_H));
}

function linesPerNextPage(): number {
  return Math.max(1, Math.floor((PAGE_H - MARGIN - 40) / LINE_H));
}

/** Octets d'un PDF affichant `title` puis `body`. */
export function textToPdfBytes(title: string, body: string): Uint8Array {
  const allLines = wrapPdfText(body.trim() || " ");
  const firstCap = linesPerFirstPage(!!title.trim());
  const nextCap = linesPerNextPage();
  const pages: string[][] = [];
  let offset = 0;
  pages.push(allLines.slice(0, firstCap));
  offset = firstCap;
  while (offset < allLines.length) {
    pages.push(allLines.slice(offset, offset + nextCap));
    offset += nextCap;
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageCount = pages.length;
  const pageObjNums = pages.map((_, i) => 3 + i);
  const contentObjNums = pages.map((_, i) => 3 + pageCount + i);
  const fontObjNum = 3 + pageCount * 2;

  objects.push(
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageCount} >>`
  );

  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjNums[i]} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>`
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const stream = pageContentStream(title, pages[i], i, pageCount);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

/** Déclenche le téléchargement du PDF dans le navigateur. */
export function downloadPdfBytes(bytes: Uint8Array, fileName: string): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
