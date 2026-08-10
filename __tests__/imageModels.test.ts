import { DEFAULT_IMAGE_MODEL_ID, resolveImageModelId } from "@/lib/imageModels";

describe("resolveImageModelId", () => {
  it("retombe sur Nanobanana (Gemini 2.5 Flash Image) par défaut", () => {
    expect(resolveImageModelId(undefined)).toBe(DEFAULT_IMAGE_MODEL_ID);
    expect(resolveImageModelId("")).toBe(DEFAULT_IMAGE_MODEL_ID);
  });

  it("corrige l'ancien slug google/nanobanana", () => {
    expect(resolveImageModelId("google/nanobanana")).toBe("google/gemini-2.5-flash-image");
  });

  it("laisse passer un slug OpenRouter valide", () => {
    expect(resolveImageModelId("google/gemini-3.1-flash-image")).toBe("google/gemini-3.1-flash-image");
  });
});
