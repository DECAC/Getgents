/** Modèle OpenRouter pour l'analyse visuelle (entrée image / frames vidéo). */
export const DEFAULT_VISION_MODEL_ID = "google/gemini-2.5-flash";

export function resolveVisionModelId(modelId?: string | null): string {
  const raw = (modelId ?? "").trim();
  return raw || DEFAULT_VISION_MODEL_ID;
}
