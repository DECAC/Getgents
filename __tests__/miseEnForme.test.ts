import { CONSIGNE_MISE_EN_FORME, CONTENU_MAX, noteEnTexte } from "@/lib/miseEnForme";
import { parseDashboard } from "@/lib/dashboardArtefact";

describe("mettre en forme une note", () => {
  const spec = parseDashboard({
    blocks: [
      { type: "heading", text: "Newsletters IA" },
      { type: "text", body: "Meta lance **Muse**." },
      { type: "table", columns: ["Source", "Sujet"], rows: [["The Batch", "Agents | outils"]] },
      { type: "checklist", title: "À lire", items: ["Éditorial"] },
    ],
  })!;

  it("envoie au modèle TOUT le contenu de la note, en markdown", () => {
    const t = noteEnTexte(spec);
    expect(t).toContain("## Newsletters IA");
    expect(t).toContain("Meta lance **Muse**.");
    expect(t).toContain("| Source | Sujet |");
    expect(t).toContain("| The Batch | Agents / outils |");
    expect(t).toContain("### À lire\n- Éditorial");
  });

  it("borne la taille envoyée, et le dit", () => {
    const long = parseDashboard({ blocks: Array.from({ length: 12 }, () => ({ type: "text", body: "x".repeat(3900) })) })!;
    const t = noteEnTexte(long);
    expect(t.length).toBeLessThanOrEqual(CONTENU_MAX + 40);
    expect(t).toContain("note tronquée");
  });

  it("la consigne interdit d'ajouter ou de perdre une information", () => {
    expect(CONSIGNE_MISE_EN_FORME).toMatch(/Conserve TOUTES les informations/);
    expect(CONSIGNE_MISE_EN_FORME).toMatch(/N'ajoute AUCUNE information/);
    expect(CONSIGNE_MISE_EN_FORME).toContain("<!--PINNED:");
  });
});
