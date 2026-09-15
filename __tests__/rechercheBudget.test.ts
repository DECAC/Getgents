import {
  budgetEpuise,
  MAX_RECHERCHES_PAR_TOUR,
  DELAI_RECHERCHE_MS,
  MESSAGE_BUDGET_EPUISE,
} from "@/lib/rechercheBudget";

describe("budget de recherche web", () => {
  it("laisse passer les premiers appels", () => {
    expect(budgetEpuise(0)).toBe(false);
    expect(budgetEpuise(MAX_RECHERCHES_PAR_TOUR - 1)).toBe(false);
  });

  it("refuse au-dela du budget", () => {
    expect(budgetEpuise(MAX_RECHERCHES_PAR_TOUR)).toBe(true);
    expect(budgetEpuise(MAX_RECHERCHES_PAR_TOUR + 3)).toBe(true);
  });

  it("garde des bornes qui tiennent dans une reponse supportable", () => {
    // Le pire cas doit rester tres en deca des 150 s mesurees en production.
    expect(MAX_RECHERCHES_PAR_TOUR * DELAI_RECHERCHE_MS).toBeLessThanOrEqual(30_000);
  });

  it("dit au modele de conclure, pas seulement qu'il a echoue", () => {
    expect(MESSAGE_BUDGET_EPUISE).toMatch(/N'appelle plus cet outil/);
    expect(MESSAGE_BUDGET_EPUISE).toMatch(/Réponds maintenant/);
  });
});
