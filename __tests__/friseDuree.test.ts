import { dureeDeLaPlage } from "@/lib/friseDuree";

const ANNEE = 2026;

describe("duree d'une plage de frise", () => {
  it("compte les annees pleines", () => {
    expect(dureeDeLaPlage("2015 — 2018", ANNEE)).toBe("3 ans");
    expect(dureeDeLaPlage("2018 - 2019", ANNEE)).toBe("1 an");
    expect(dureeDeLaPlage("2018 – 2022", ANNEE)).toBe("4 ans");
  });

  it("ouvre la plage sur l'annee courante", () => {
    expect(dureeDeLaPlage("2022 — aujourd'hui", ANNEE)).toBe("4 ans");
    expect(dureeDeLaPlage("2022 — en cours", ANNEE)).toBe("4 ans");
  });

  it("combine annees et mois quand les deux bouts en portent", () => {
    expect(dureeDeLaPlage("mars 2019 — juin 2021", ANNEE)).toBe("2 ans 3 mois");
    expect(dureeDeLaPlage("janvier 2020 — juin 2020", ANNEE)).toBe("5 mois");
  });

  it("accepte les accents absents", () => {
    expect(dureeDeLaPlage("fevrier 2020 — aout 2021", ANNEE)).toBe("1 an 6 mois");
  });

  // L'ARBITRAGE : le silence plutot que l'approximation.
  it("ne devine RIEN hors des formes reconnues", () => {
    expect(dureeDeLaPlage("2022", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("Migration 018", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("T3 2025 — T1 2026", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("mi-2019 — fin 2021", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("2018 — 2019 — 2020", ANNEE)).toBeNull();
  });

  it("ne coupe pas sur le tiret d'un mot compose", () => {
    expect(dureeDeLaPlage("mi-2019", ANNEE)).toBeNull();
  });

  it("refuse une plage qui recule ou nulle", () => {
    expect(dureeDeLaPlage("2022 — 2018", ANNEE)).toBeNull();
    expect(dureeDeLaPlage("2022 — 2022", ANNEE)).toBeNull();
  });

  it("ne part pas d'une borne ouverte", () => {
    expect(dureeDeLaPlage("aujourd'hui — 2030", ANNEE)).toBeNull();
  });

  it("ne leve jamais sur une entree inattendue", () => {
    expect(dureeDeLaPlage(undefined as never, ANNEE)).toBeNull();
    expect(dureeDeLaPlage(42 as never, ANNEE)).toBeNull();
  });
});
