import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Invariant : le worker pdf.js servi depuis public/pdfjs est celui de la
 * version installée. pdf.js compare strictement les deux versions et rejette
 * le document en cas d'écart — l'extraction de texte des PDF de la base de
 * connaissance échoue alors pour TOUS les fichiers, sans autre symptôme que
 * « contenu non lu ». Si ce test casse : `node scripts/sync-pdf-worker.mjs`.
 */
describe("worker pdf.js vendorisé", () => {
  it("est identique à celui de la version installée de pdfjs-dist", () => {
    const root = join(__dirname, "..");
    // Fins de ligne normalisées : sous Windows, git peut livrer le fichier
    // suivi en CRLF alors que node_modules reste en LF.
    const sha = (p: string) =>
      createHash("sha256").update(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
    const installed = sha(join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"));
    const vendored = sha(join(root, "public", "pdfjs", "pdf.worker.min.mjs"));
    expect(vendored).toBe(installed);
  });
});
