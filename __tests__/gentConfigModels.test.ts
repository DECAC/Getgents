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
  it("extrait chat + reasoning avec ids valides", () => {
    const raw =
      'Voici. <!--GENT_CONFIG: {"chatModelId":"anthropic/claude-sonnet-5","reasoningModelId":"deepseek/deepseek-r1"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBe("anthropic/claude-sonnet-5");
    expect(config?.reasoningModelId).toBe("deepseek/deepseek-r1");
  });

  it("résout les libellés vers les ids catalogue", () => {
    const raw = '<!--GENT_CONFIG: {"chatModelId":"Mistral Large","reasoningModelId":"o4-mini"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBe("mistralai/mistral-large");
    expect(config?.reasoningModelId).toBe("openai/o4-mini");
  });

  it("ignore un reasoning collé dans chatModelId", () => {
    const raw = '<!--GENT_CONFIG: {"chatModelId":"deepseek/deepseek-r1"}-->';
    const { config } = extractGentConfigSignal(raw);
    expect(config?.chatModelId).toBeUndefined();
  });
});
