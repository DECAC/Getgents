import { extractDocumentForViewer } from "@/lib/documentViewer";

function textFile(content: string, name = "note.md"): File {
  return new File([content], name, { type: "text/markdown" });
}

describe("visionneuse de document — texte / markdown", () => {
  it("détecte les titres # et les rattache à la bonne page", async () => {
    const long = "x".repeat(3000);
    const content = `# Introduction\n${long}\n\n## Détails\n${long}`;
    const spec = await extractDocumentForViewer(textFile(content));

    expect(spec.sourceKind).toBe("text");
    expect(spec.pageCount).toBeGreaterThan(1);
    expect(spec.toc.map((t) => t.title)).toEqual(["Introduction", "Détails"]);
    expect(spec.toc[0].page).toBe(0);
    // Le second titre tombe après ~3000 caractères de remplissage : sur une
    // page ultérieure, jamais sur la première.
    expect(spec.toc[1].page).toBeGreaterThan(0);
  });

  it("reste utilisable sans aucun titre détecté (navigation par page seule)", async () => {
    const spec = await extractDocumentForViewer(textFile("juste du texte, sans structure."));
    expect(spec.toc).toEqual([]);
    expect(spec.pageCount).toBe(1);
    expect(spec.pages[0]).toContain("juste du texte");
  });

  it("tronque au-delà du budget plutôt que de produire un espace trop lourd", async () => {
    // ~1.2M caractères, largement au-dessus de la limite de la visionneuse.
    const huge = "a".repeat(1_200_000);
    const spec = await extractDocumentForViewer(textFile(huge));
    expect(spec.truncated).toBe(true);
    const totalChars = spec.pages.reduce((n, p) => n + p.length, 0);
    expect(totalChars).toBeLessThan(1_200_000);
  });

  it("rejette le format .doc non pris en charge avec un message actionnable", async () => {
    await expect(extractDocumentForViewer(textFile("x", "ancien.doc"))).rejects.toThrow(/\.docx|PDF/);
  });

  it("rejette un format inconnu", async () => {
    const png = new File(["x"], "photo.png", { type: "image/png" });
    await expect(extractDocumentForViewer(png)).rejects.toThrow(/non pris en charge/);
  });
});
