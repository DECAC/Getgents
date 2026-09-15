/**
 * Modèles image OpenRouter. « Nanobanana » est le surnom marketing de
 * Gemini Flash Image — l'ancien slug `google/nanobanana` n'existe plus.
 */

/** Modèle bon marché par défaut (Nano Banana / Gemini 2.5 Flash Image). */
export const DEFAULT_IMAGE_MODEL_ID = "google/gemini-2.5-flash-image";

/** Anciens IDs encore présents dans des gents publiés → slug OpenRouter actuel. */
const IMAGE_MODEL_ALIASES: Record<string, string> = {
  "google/nanobanana": DEFAULT_IMAGE_MODEL_ID,
  nanobanana: DEFAULT_IMAGE_MODEL_ID,
  "google/nano-banana": DEFAULT_IMAGE_MODEL_ID,
};

export function resolveImageModelId(modelId?: string | null): string {
  const raw = (modelId ?? "").trim() || DEFAULT_IMAGE_MODEL_ID;
  return IMAGE_MODEL_ALIASES[raw] ?? raw;
}
