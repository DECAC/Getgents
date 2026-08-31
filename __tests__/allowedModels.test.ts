import {
  DEFAULT_CHAT_MODEL_ID,
  PLATFORM_MODEL_IDS,
  isPlatformModel,
  resolveModelId,
} from "@/lib/allowedModels";

describe("modèles autorisés sur la clé plateforme", () => {
  it("accepte ce que le studio propose", () => {
    expect(PLATFORM_MODEL_IDS.length).toBeGreaterThan(3);
    expect(isPlatformModel("moonshotai/kimi-k3")).toBe(true);
    expect(isPlatformModel(DEFAULT_CHAT_MODEL_ID)).toBe(true);
  });

  it("refuse un identifiant qui n'est pas au catalogue", () => {
    // Le scénario : un appelant anonyme demande le modèle le plus cher
    // d'OpenRouter sur notre compte.
    expect(isPlatformModel("un/modele-tres-cher")).toBe(false);
    expect(isPlatformModel(undefined)).toBe(false);
    expect(isPlatformModel(42)).toBe(false);
    expect(isPlatformModel({ id: "moonshotai/kimi-k3" })).toBe(false);
  });

  it("retombe sur le défaut au lieu d'échouer", () => {
    // Un gent configuré avec un modèle retiré du catalogue doit continuer à
    // répondre : refuser la requête punirait le créateur pour notre décision.
    expect(resolveModelId("un/modele-inconnu")).toBe(DEFAULT_CHAT_MODEL_ID);
    expect(resolveModelId(null)).toBe(DEFAULT_CHAT_MODEL_ID);
  });

  it("laisse l'appelant imposer son propre défaut, s'il est légitime", () => {
    expect(resolveModelId(null, "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
    expect(resolveModelId(null, "un/repli-douteux")).toBe(DEFAULT_CHAT_MODEL_ID);
  });

  it("ne renvoie jamais autre chose qu'un modèle du catalogue", () => {
    for (const entree of ["", "x", "openai/gpt-4.1", null, undefined, 0, [], {}]) {
      expect(isPlatformModel(resolveModelId(entree))).toBe(true);
    }
  });
});
