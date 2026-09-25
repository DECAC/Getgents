import { demandeEnSavoirPlus, EXTRAIT_MAX, extraitSelection } from "@/lib/enSavoirPlus";

describe("En savoir plus sur un passage surligné", () => {
  it("ignore une sélection trop courte ou vide", () => {
    expect(extraitSelection("")).toBeNull();
    expect(extraitSelection(null)).toBeNull();
    expect(extraitSelection("  IA  ")).toBeNull();
  });

  it("resserre les espaces et les retours à la ligne", () => {
    expect(extraitSelection("  Les influenceurs\n\n  IA   ciblent ")).toBe("Les influenceurs IA ciblent");
  });

  it("tronque un passage trop long", () => {
    const e = extraitSelection("mot ".repeat(400))!;
    expect(e.length).toBeLessThanOrEqual(EXTRAIT_MAX);
    expect(e.endsWith("…")).toBe(true);
  });

  it("la demande cite le passage et invite à approfondir", () => {
    const d = demandeEnSavoirPlus("Les influenceurs IA ciblent les travailleurs FIFO");
    expect(d).toContain("« Les influenceurs IA ciblent les travailleurs FIFO »");
    expect(d).toMatch(/Approfondis/);
    expect(d).toMatch(/outils/);
  });
});
