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

export async function extractDocumentText(file: File): Promise<ExtractedDoc> {
  const name = file.name;
  const lower = name.toLowerCase();
  let text = "";

  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdf(file);
  } else if (lower.endsWith(".docx")) {
    text = await extractDocx(file);
  } else if (lower.endsWith(".doc")) {
    throw new Error(
      "Le format .doc (ancien Word) n'est pas pris en charge. Enregistrez le fichier en .docx ou en PDF puis réessayez."
    );
  } else if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
    text = await file.text();
  } else {
    throw new Error("Format non pris en charge. Formats acceptés : PDF, Word (.docx), texte (.txt, .md).");
  }

  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) {
    throw new Error("Aucun texte n'a pu être extrait (document vide, scanné en image, ou protégé).");
  }
  const truncated = text.length > MAX_CHARS;
  return { name, text: truncated ? text.slice(0, MAX_CHARS) : text, truncated };
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
