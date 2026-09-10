import { extractGentConfigSignal, resolveModelIdForCapability } from "@/lib/gentConfigSignal";

describe("resolveModelIdForCapability", () => {
  it("accepte l'id OpenRouter exact pour la bonne capacité", () => {
    expect(resolveModelIdForCapability("mistralai/mistral-large", "chat")).toBe("mistralai/mistral-large");
    expect(resolveModelIdForCapability("deepseek/deepseek-r1", "reasoning")).toBe("deepseek/deepseek-r1");
  });

  it("accepte le libellé catalogue", () => {
    expect(resolveModelIdForCapability("Mistral Large", "chat")).toBe("mistralai/mistral-large");
    expect(resolveModelIdForCapability("DeepSeek R1", "reasoning")).toBe("deepseek/deepseek-r1");
  });

  it("refuse un id de mauvaise capacité", () => {
    expect(resolveModelIdForCapability("deepseek/deepseek-r1", "chat")).toBeUndefined();
    expect(resolveModelIdForCapability("mistralai/mistral-large", "reasoning")).toBeUndefined();
  });
});

describe("extractGentConfigSignal — modèles", () => {
  it("extrait le modèle de conversation", () => {
    const raw = 'Voici. <!--GENT_CONFIG: {"chatModelId":"anthropic/claude-sonnet-5"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBe("anthropic/claude-sonnet-5");
  });

  it("résout un libellé vers l'id catalogue", () => {
    const raw = '<!--GENT_CONFIG: {"chatModelId":"Mistral Large"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBe("mistralai/mistral-large");
  });

  /**
   * `reasoningModelId` a ete RETIRE : il etait affiche, recommande et
   * configurable, mais jamais lu au moment de generer. Un assistant entraine
   * sur d'anciens exemples peut encore l'emettre — le champ doit alors etre
   * ignore en silence, jamais faire echouer l'extraction du reste.
   */
  it("ignore un reasoningModelId hérité sans perdre le reste", () => {
    const raw =
      '<!--GENT_CONFIG: {"chatModelId":"anthropic/claude-sonnet-5","reasoningModelId":"deepseek/deepseek-r1"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBe("anthropic/claude-sonnet-5");
    expect((config as Record<string, unknown> | null)?.reasoningModelId).toBeUndefined();
  });

  it("ignore un reasoning collé dans chatModelId", () => {
    const raw = '<!--GENT_CONFIG: {"chatModelId":"deepseek/deepseek-r1"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBeUndefined();
  });
});
