import { formatOpenRouterError, supportsReasoningStream } from "@/lib/openRouterReasoning";

describe("supportsReasoningStream", () => {
  it("accepte Claude et les modèles reasoning du catalogue", () => {
    expect(supportsReasoningStream("anthropic/claude-sonnet-5")).toBe(true);
    expect(supportsReasoningStream("deepseek/deepseek-r1")).toBe(true);
    expect(supportsReasoningStream("openai/o4-mini")).toBe(true);
  });

  it("refuse Mistral Large et GPT-4.1", () => {
    expect(supportsReasoningStream("mistralai/mistral-large")).toBe(false);
    expect(supportsReasoningStream("openai/gpt-4.1")).toBe(false);
    expect(supportsReasoningStream("google/gemini-2.5-flash")).toBe(false);
  });
});

describe("formatOpenRouterError", () => {
  it("extrait le message imbriqué OpenRouter", () => {
    const text = formatOpenRouterError({
      error: { message: "Provider returned error", metadata: { provider_name: "Mistral" } },
    });
    expect(text).toContain("Provider returned error");
    expect(text).toContain("Mistral");
  });
});
