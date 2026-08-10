// Extraction d'un document pour la visionneuse pleine page — distincte de
// extractDocumentText.ts (pièce jointe conversationnelle, limitée à 15k
// caractères) : ici on veut le document ENTIER, paginé, avec son sommaire
// quand il existe, pour une lecture immersive de plusieurs dizaines ou
// centaines de pages.
import type { DocumentViewerSection, DocumentViewerSpec } from "@/lib/types";

/**
 * Budget de caractères total. Au-delà, on tronque plutôt que de risquer un
 * espace impossible à charger (le document rejoint published_gents.espace,
 * synchronisé en JSON) — un document coupé et signalé reste utilisable, un
 * espace qui ne charge plus plombe tout le gent.
 */
const MAX_VIEWER_CHARS = 400_000;
/** Taille visée d'une « page » reconstituée (Word, texte) — proche d'une page A4 dense. */
const SYNTHETIC_PAGE_CHARS = 2_800;

export async function extractDocumentForViewer(file: File): Promise<DocumentViewerSpec> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfForViewer(file);
  }
  if (lower.endsWith(".docx")) {
    return extractDocxForViewer(file);
  }
  if (lower.endsWith(".doc")) {
    throw new Error(
      "Le format .doc (ancien Word) n'est pas pris en charge. Enregistrez le fichier en .docx ou en PDF puis réessayez."
    );
  }
  if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
    return extractPlainForViewer(file);
  }
  throw new Error("Format non pris en charge par la visionneuse. Formats acceptés : PDF, Word (.docx), texte (.txt, .md).");
}

function capPages(pages: string[]): { pages: string[]; truncated: boolean } {
  let used = 0;
  const kept: string[] = [];
  for (const p of pages) {
    if (used + p.length > MAX_VIEWER_CHARS) {
      return { pages: kept, truncated: true };
    }
    used += p.length;
    kept.push(p);
  }
  return { pages: kept, truncated: false };
}

// ---------- PDF : pagination native + signets ----------

async function extractPdfForViewer(file: File): Promise<DocumentViewerSpec> {
  const pdfjs = await import("pdfjs-dist");
  // Worker servi localement (public/pdfjs) plutôt que depuis un CDN tiers :
  // évite toute dépendance réseau externe au runtime.
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    "/pdfjs/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const rawPages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    rawPages.push(text || "(page sans texte extractible — probablement une image)");
  }

  const { pages, truncated } = capPages(rawPages);
  const toc = await extractPdfOutline(doc, pdfjs).catch(() => []);

  return {
    sourceName: file.name,
    sourceKind: "pdf",
    pageCount: pages.length,
    pages,
    // Les signets peuvent pointer au-delà de la coupe : on les ignore plutôt
    // que d'offrir un sommaire qui mène dans le vide.
    toc: toc.filter((t) => t.page < pages.length),
    truncated,
  };
}

/**
 * Sommaire natif du PDF (signets), résolu en numéros de page. Absent pour la
 * plupart des PDF sans structure explicite — la visionneuse bascule alors
 * sur une navigation par page seule.
 */
async function extractPdfOutline(
  doc: import("pdfjs-dist").PDFDocumentProxy,
  pdfjs: typeof import("pdfjs-dist")
): Promise<DocumentViewerSection[]> {
  const outline = await doc.getOutline();
  if (!outline?.length) return [];

  const sections: DocumentViewerSection[] = [];
  let seq = 0;

  async function resolvePage(dest: unknown): Promise<number | null> {
    try {
      const resolved = typeof dest === "string" ? await doc.getDestination(dest) : (dest as unknown[]);
      const ref = resolved?.[0];
      if (!ref) return null;
      return await doc.getPageIndex(ref as never);
    } catch {
      return null;
    }
  }

  async function walk(items: Awaited<ReturnType<typeof doc.getOutline>>, level: number) {
    if (!items) return;
    for (const item of items) {
      const page = await resolvePage(item.dest);
      if (page !== null) {
        sections.push({ id: `toc-${seq++}`, title: item.title || "Sans titre", level, page });
      }
      if (item.items?.length) await walk(item.items, level + 1);
    }
  }

  await walk(outline, 1);
  void pdfjs; // signature conservée pour clarté de l'appelant, non utilisée directement ici
  return sections;
}

// ---------- Word : titres HTML + découpage en pages synthétiques ----------

async function extractDocxForViewer(file: File): Promise<DocumentViewerSpec> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const { text, headings } = htmlToTextWithHeadings(result.value);
  return chunkIntoSpec(file.name, "docx", text, headings);
}

/**
 * Convertit l'HTML de mammoth en texte brut tout en repérant la position
 * (en caractères, dans le texte brut résultant) de chaque titre h1-h3 — c'est
 * cette position qui permet ensuite de rattacher chaque entrée de sommaire à
 * la bonne page synthétique.
 */
function htmlToTextWithHeadings(html: string): { text: string; headings: { title: string; level: number; offset: number }[] } {
  const headings: { title: string; level: number; offset: number }[] = [];
  let text = "";

  // Découpe sur les balises de bloc ; suffisant ici (pas de DOM disponible
  // côté serveur, et cette extraction tourne aussi côté navigateur sans
  // dépendance à DOMParser pour rester simple et symétrique).
  const blockRe = /<(h[1-3]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(html))) {
    const tag = match[1].toLowerCase();
    const raw = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw) continue;

    if (tag.startsWith("h")) {
      headings.push({ title: raw, level: Number(tag[1]), offset: text.length });
    }
    text += raw + "\n\n";
  }
  return { text: text.trim(), headings };
}

// ---------- Texte / Markdown : titres # et découpage ----------

async function extractPlainForViewer(file: File): Promise<DocumentViewerSpec> {
  const raw = (await file.text()).replace(/\r\n/g, "\n");
  const headings: { title: string; level: number; offset: number }[] = [];

  const headingRe = /^(#{1,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(raw))) {
    headings.push({ title: match[2].trim(), level: match[1].length, offset: match.index });
  }

  return chunkIntoSpec(file.name, "text", raw.trim(), headings);
}

/** Découpe un texte long en pages synthétiques et rattache chaque titre à la page où il tombe. */
function chunkIntoSpec(
  sourceName: string,
  sourceKind: "docx" | "text",
  text: string,
  headings: { title: string; level: number; offset: number }[]
): DocumentViewerSpec {
  const rawPages: string[] = [];
  for (let i = 0; i < text.length; i += SYNTHETIC_PAGE_CHARS) {
    rawPages.push(text.slice(i, i + SYNTHETIC_PAGE_CHARS));
  }
  if (rawPages.length === 0) rawPages.push("(document vide)");

  const { pages, truncated } = capPages(rawPages);
  const cutoffChars = pages.length * SYNTHETIC_PAGE_CHARS;

  const toc: DocumentViewerSection[] = headings
    .filter((h) => h.offset < cutoffChars)
    .map((h, i) => ({
      id: `toc-${i}`,
      title: h.title,
      level: h.level,
      page: Math.min(Math.floor(h.offset / SYNTHETIC_PAGE_CHARS), pages.length - 1),
    }));

  return {
    sourceName,
    sourceKind,
    pageCount: pages.length,
    pages,
    toc,
    truncated,
  };
}
