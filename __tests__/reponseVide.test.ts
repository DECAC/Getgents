import { estCoupureReseau, estReponseVide, MESSAGE_CONNEXION_COUPEE, MESSAGE_REPONSE_VIDE } from "@/lib/reponseVide";
import { GMAIL_PROMPT_INSTRUCTION } from "@/lib/gmailPrompt";
import {
  BUDGET_OUTILS_MS,
  CONSIGNE_DERNIER_TOUR,
  MAX_TOURS_OUTILS,
  MESSAGE_REPONSE_FINALE_MANQUANTE,
  outilsEncoreAutorises,
} from "@/lib/boucleOutils";

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

describe("connexion coupée pendant la réponse", () => {
  it("un TypeError de fetch est une coupure réseau", () => {
    expect(estCoupureReseau(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("un refus du service (quota, clé) n'en est pas une : son message reste affiché", () => {
    expect(estCoupureReseau(new Error("Quota atteint"))).toBe(false);
  });

  it("le message de coupure est visible", () => {
    expect(estReponseVide(MESSAGE_CONNEXION_COUPEE)).toBe(false);
  });
});

describe("consigne Gmail", () => {
  it("fait chercher avant de demander, avec la syntaxe qui trouve les newsletters", () => {
    expect(GMAIL_PROMPT_INSTRUCTION).toContain("CHERCHE D'ABORD");
    expect(GMAIL_PROMPT_INSTRUCTION).toContain("category:promotions");
    expect(GMAIL_PROMPT_INSTRUCTION).toContain(" OR ");
  });
});

describe("dernier tour sans outils", () => {
  it("laisse 7 tours d'outils avant la rédaction — un bilan à trois expéditeurs en a pris 5", () => {
    expect(MAX_TOURS_OUTILS).toBe(8);
    expect(outilsEncoreAutorises(6, 0)).toBe(true);
    expect(outilsEncoreAutorises(7, 0)).toBe(false);
  });

  it("dit au modèle que les outils sont retirés et qu'il doit conclure", () => {
    expect(CONSIGNE_DERNIER_TOUR).toMatch(/Plus aucun outil/);
    expect(CONSIGNE_DERNIER_TOUR).toMatch(/réponse finale/);
  });

  it("le message de réponse manquante propose quoi faire", () => {
    expect(MESSAGE_REPONSE_FINALE_MANQUANTE).toMatch(/Réessayez/);
  });
});
