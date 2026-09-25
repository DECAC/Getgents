import { estReponseVide, MESSAGE_REPONSE_VIDE } from "@/lib/reponseVide";
import { BUDGET_OUTILS_MS, MAX_TOURS_OUTILS, outilsEncoreAutorises } from "@/lib/boucleOutils";

describe("réponse vide du gent", () => {
  it("un HTML sans texte visible est vide", () => {
    expect(estReponseVide("")).toBe(true);
    expect(estReponseVide("<p></p>")).toBe(true);
    expect(estReponseVide("<p>&nbsp;</p>\n")).toBe(true);
    expect(estReponseVide(undefined)).toBe(true);
  });

  it("le moindre texte n'est pas vide", () => {
    expect(estReponseVide("<p>Voici le bilan.</p>")).toBe(false);
  });

  it("le message de repli, lui, n'est pas vide", () => {
    expect(estReponseVide(MESSAGE_REPONSE_VIDE)).toBe(false);
  });
});

describe("budget de la boucle d'outils", () => {
  it("offre les outils au début", () => {
    expect(outilsEncoreAutorises(0, 0)).toBe(true);
  });

  it("force la réponse au dernier tour", () => {
    expect(outilsEncoreAutorises(MAX_TOURS_OUTILS - 1, 0)).toBe(false);
  });

  it("force la réponse quand le temps des outils est écoulé, même avant la limite de tours", () => {
    expect(outilsEncoreAutorises(2, BUDGET_OUTILS_MS)).toBe(false);
  });

  it("laisse au moins deux minutes pour rédiger avant la coupure à 300 s", () => {
    expect(300_000 - BUDGET_OUTILS_MS).toBeGreaterThanOrEqual(120_000);
  });
});
