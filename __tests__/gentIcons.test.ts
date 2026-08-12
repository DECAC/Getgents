import { DEFAULT_GENT_ICON, GENT_ICON_PALETTE, suggestGentIcon } from "@/lib/gentIcons";
import { STUDIO_EXAMPLES } from "@/lib/studioExamples";

describe("suggestGentIcon", () => {
  it("reconnaît le thème malgré les accents et la casse", () => {
    expect(suggestGentIcon("Un gent qui trie ma boîte Gmail")).toBe("📧");
    expect(suggestGentIcon("UN GENT QUI ANALYSE UNE VIDEO")).toBe("🎬");
    expect(suggestGentIcon("un gent de veille sur l'actualité du secteur")).toBe("🗞️");
  });

  it("préfère l'intention précise au thème large", () => {
    // « notes » et « documents » ne doivent pas éclipser la rédaction demandée.
    expect(suggestGentIcon("Un gent qui prépare mes comptes rendus de réunion à partir de mes notes")).toBe("📝");
  });

  it("retombe sur l'emblème par défaut sans indice", () => {
    expect(suggestGentIcon("Un gent")).toBe(DEFAULT_GENT_ICON);
    expect(suggestGentIcon("   ")).toBe(DEFAULT_GENT_ICON);
  });
});

describe("GENT_ICON_PALETTE", () => {
  it("ne propose aucun doublon", () => {
    expect(new Set(GENT_ICON_PALETTE).size).toBe(GENT_ICON_PALETTE.length);
  });

  it("contient tous les emblèmes que la déduction peut produire", () => {
    // Un emblème suggéré mais absent du sélecteur serait impossible à retrouver
    // après l'avoir changé.
    const suggestions = [
      "email",
      "vidéo",
      "veille",
      "métro",
      "budget",
      "compte rendu",
      "tableau de bord",
      "visionneuse",
      "procédure",
      "réunion",
      "commande",
      "juridique",
      "immobilier",
      "voyage",
      "formation",
      "santé",
      "code",
      "image",
      "whatsapp",
      "accompagner",
      "api",
    ];
    for (const term of suggestions) {
      expect(GENT_ICON_PALETTE).toContain(suggestGentIcon(term));
    }
  });

  it("contient les emblèmes des exemples de l'accueil du studio", () => {
    for (const example of STUDIO_EXAMPLES) {
      expect(GENT_ICON_PALETTE).toContain(example.icon);
    }
  });
});
