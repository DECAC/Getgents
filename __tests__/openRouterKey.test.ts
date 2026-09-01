import {
  indiceDeCle,
  cleOpenRouterPlausible,
  messageCleOpenRouter,
  quotaApplicable,
} from "@/lib/openRouterKey";
import { normaliserCatalogue, avecModeleConfigure } from "@/lib/openRouterCatalog";

describe("indiceDeCle", () => {
  it("ne montre que les quatre derniers caractères", () => {
    expect(indiceDeCle("sk-or-v1-0123456789abcdef4f2a")).toBe("…4f2a");
  });

  it("ne fuit rien d'une valeur trop courte", () => {
    expect(indiceDeCle("ab")).toBe("…");
  });
});

describe("cleOpenRouterPlausible", () => {
  it("accepte une clé au format OpenRouter", () => {
    expect(cleOpenRouterPlausible("sk-or-v1-" + "a".repeat(48))).toBe(true);
  });

  it("refuse ce qui n'en est manifestement pas une", () => {
    expect(cleOpenRouterPlausible("charles@example.com")).toBe(false);
    expect(cleOpenRouterPlausible("sk-ant-api03-xxxxxxxxxxxxxxxxxxxx")).toBe(false);
    expect(cleOpenRouterPlausible("sk-or-court")).toBe(false);
    expect(cleOpenRouterPlausible("sk-or-v1 " + "a".repeat(40))).toBe(false);
    expect(cleOpenRouterPlausible(null)).toBe(false);
    expect(cleOpenRouterPlausible(42)).toBe(false);
  });
});

describe("messageCleOpenRouter", () => {
  it("renvoie le builder vers son compte quand SA clé est refusée", () => {
    const m = messageCleOpenRouter({ source: "personnelle", status: 401 });
    expect(m).toMatch(/Mon compte/);
  });

  it("distingue le crédit épuisé du refus", () => {
    expect(messageCleOpenRouter({ source: "personnelle", status: 402 })).toMatch(/crédit/i);
  });

  it("ne divulgue jamais l'état de la clé plateforme", () => {
    for (const status of [0, 401, 402, 429, 500]) {
      const m = messageCleOpenRouter({ source: "plateforme", status });
      expect(m).not.toMatch(/OPENROUTER_API_KEY|\.env|révoqu/i);
    }
  });
});

describe("quotaApplicable", () => {
  it("ne bride que la clé commune", () => {
    expect(quotaApplicable("plateforme")).toBe(true);
    expect(quotaApplicable("personnelle")).toBe(false);
  });
});

describe("normaliserCatalogue", () => {
  const reponse = {
    data: [
      {
        id: "anthropic/claude-sonnet-5",
        name: "Claude Sonnet 5",
        description: "Raisonnement solide.",
        context_length: 200000,
        architecture: { modality: "text+image->text", output_modalities: ["text"] },
        pricing: { prompt: "0.000003", completion: "0.000015" },
      },
      {
        id: "google/gemini-2.5-flash-image",
        name: "Gemini Flash Image",
        architecture: { modality: "text->image", output_modalities: ["image"] },
        pricing: { prompt: "0", completion: "0" },
      },
    ],
  };

  it("traduit une réponse réaliste", () => {
    const c = normaliserCatalogue(reponse);
    expect(c).toHaveLength(2);
    const sonnet = c.find((m) => m.id === "anthropic/claude-sonnet-5")!;
    expect(sonnet.label).toBe("Claude Sonnet 5");
    expect(sonnet.provider).toBe("Anthropic");
    expect(sonnet.capability).toBe("chat");
    expect(sonnet.contextWindow).toBe(200000);
    // Le prix d'OpenRouter est au token ; le studio l'affiche au million.
    expect(sonnet.pricing).toEqual({ input: 3, output: 15 });
    expect(c.find((m) => m.id.endsWith("flash-image"))!.capability).toBe("image");
  });

  it("ne lève jamais, quelle que soit l'entrée", () => {
    for (const entree of [null, undefined, {}, [], 42, "texte", { data: "pas un tableau" }]) {
      expect(() => normaliserCatalogue(entree)).not.toThrow();
      expect(normaliserCatalogue(entree)).toEqual([]);
    }
  });

  it("survit aux champs manquants et aux prix à zéro", () => {
    const c = normaliserCatalogue({ data: [{ id: "x/y" }, null, { name: "sans id" }, 7] });
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ id: "x/y", label: "x/y", pricing: { input: 0, output: 0 } });
    expect(c[0].contextWindow).toBeUndefined();
  });

  it("écarte les doublons d'identifiant", () => {
    expect(normaliserCatalogue({ data: [{ id: "a/b" }, { id: "a/b" }] })).toHaveLength(1);
  });
});

describe("avecModeleConfigure", () => {
  it("garde en tête un modèle absent du catalogue plutôt que de l'effacer", () => {
    const c = avecModeleConfigure([{ id: "a/b" } as never], "disparu/modele");
    expect(c[0].id).toBe("disparu/modele");
    expect(c[0].tagline).toMatch(/plus disponible/i);
  });

  it("ne double pas un modèle déjà présent", () => {
    const catalogue = normaliserCatalogue({ data: [{ id: "a/b" }] });
    expect(avecModeleConfigure(catalogue, "a/b")).toHaveLength(1);
    expect(avecModeleConfigure(catalogue, null)).toHaveLength(1);
  });
});
