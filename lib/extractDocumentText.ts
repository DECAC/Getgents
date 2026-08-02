// Extraction de texte d'un document (PDF, Word .docx, texte) côté navigateur.
// Les bibliothèques lourdes (pdfjs, mammoth) sont importées dynamiquement pour
// ne pas alourdir le chargement initial et rester hors du rendu serveur.

export interface ExtractedDoc {
  name: string;
  text: string;
  truncated: boolean;
}

/** Limite de caractères injectés dans la conversation (assez pour un CV, un rapport court…). */
const MAX_CHARS = 15_000;
/**
 * Les tableurs portent une ligne par enregistrement : la limite des documents
 * narratifs y couperait après quelques centaines de lignes (un export de
 * relations LinkedIn en compte souvent plus d'un millier).
 */
const MAX_CHARS_TABULAR = 60_000;

export async function extractDocumentText(file: File): Promise<ExtractedDoc> {
  const name = file.name;
  const lower = name.toLowerCase();
  let text = "";
  let limit = MAX_CHARS;

  const isCsv = lower.endsWith(".csv");
  const isTsv = lower.endsWith(".tsv");

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdf(file);
  } else if (lower.endsWith(".docx")) {
    text = await extractDocx(file);
  } else if (lower.endsWith(".doc")) {
    throw new Error(
      "Le format .doc (ancien Word) n'est pas pris en charge. Enregistrez le fichier en .docx ou en PDF puis réessayez."
    );
  } else if (isCsv || isTsv) {
    // Détection par extension et non par type MIME : Windows annonce souvent un
    // .csv comme application/vnd.ms-excel, ce qui le ferait rejeter à tort.
    text = compactDelimited(await file.text(), isTsv ? "\t" : ",");
    limit = MAX_CHARS_TABULAR;
  } else if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
    text = await file.text();
  } else {
    throw new Error(
      "Format non pris en charge. Formats acceptés : PDF, Word (.docx), texte (.txt, .md) et tableur (.csv, .tsv)."
    );
  }

  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    throw new Error("Aucun texte n'a pu être extrait (document vide, scanné en image, ou protégé).");
  }
  const truncated = text.length > limit;
  return { name, text: truncated ? text.slice(0, limit) : text, truncated };
}

/** Découpe une ligne délimitée en respectant les guillemets et les "" échappés. */
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      out.push(field.trim());
      field = "";
    } else field += c;
  }
  out.push(field.trim());
  return out;
}

/**
 * Normalise un fichier délimité avant de l'envoyer au modèle :
 * - saute le préambule que certains exports placent avant l'en-tête (celui de
 *   LinkedIn commence par « Notes: », ce qui décale toutes les colonnes) ;
 * - retire les colonnes d'adresses e-mail — inutiles à l'analyse et
 *   inutilement sensibles, surtout quand il s'agit de tiers ;
 * - abandonne les colonnes entièrement vides, qui ne coûtent que du volume.
 * En cas de doute (aucun en-tête plausible), le contenu est laissé tel quel.
 */
export function compactDelimited(raw: string, delimiter: string): string {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);

  const headerIdx = lines.findIndex(
    (l) => !/^\s*notes\s*:/i.test(l) && parseDelimitedLine(l, delimiter).filter((c) => c !== "").length >= 2
  );
  if (headerIdx === -1) return raw;

  const header = parseDelimitedLine(lines[headerIdx], delimiter);
  const rows = lines
    .slice(headerIdx + 1)
    .filter((l) => l.trim() !== "")
    .map((l) => parseDelimitedLine(l, delimiter));

  const keep = header.map((col, i) => {
    if (/e-?mail/i.test(col)) return false;
    return rows.some((r) => (r[i] ?? "") !== "");
  });
  if (!keep.some(Boolean)) return raw;

  const pick = (cells: string[]) => cells.filter((_, i) => keep[i]).join(delimiter === "\t" ? "\t" : ",");
  return [pick(header), ...rows.map(pick)].join("\n");
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker chargé depuis un CDN, à la version exacte du paquet installé.
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(line);
  }
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
