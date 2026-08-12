import { MODEL_CATALOG } from "@/lib/mock-data/builder";

/** Modèles du catalogue explicitement dédiés au raisonnement. */
const REASONING_CATALOG_IDS = new Set(
  MODEL_CATALOG.filter((m) => m.capability === "reasoning").map((m) => m.id)
);

/** Préfixes de modèles conversationnels connus pour accepter reasoning sur OpenRouter. */
const REASONING_MODEL_PREFIXES = ["anthropic/claude", "openai/o"];

/**
 * OpenRouter n'accepte `reasoning: { enabled: true }` que sur certains modèles.
 * L'envoyer à Mistral Large, GPT-4.1, etc. provoque « Provider returned error ».
 */
export function supportsReasoningStream(modelId: string | undefined | null): boolean {
  const id = modelId?.trim();
  if (!id) return false;
  if (REASONING_CATALOG_IDS.has(id)) return true;
  const lower = id.toLowerCase();
  return REASONING_MODEL_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** Extrait un message d'erreur lisible depuis une réponse OpenRouter. */
export function formatOpenRouterError(data: unknown): string {
  if (!data || typeof data !== "object") return "Provider returned error";
  const root = data as Record<string, unknown>;
  const err = root.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message.trim() : "";
    const metadata = obj.metadata as Record<string, unknown> | undefined;
    const provider = typeof metadata?.provider_name === "string" ? metadata.provider_name : null;
    const raw = typeof metadata?.raw === "string" ? metadata.raw : null;
    const parts = [message || "Provider returned error", provider ? `(fournisseur : ${provider})` : "", raw ? raw.slice(0, 200) : ""]
      .filter(Boolean)
      .join(" ");
    if (parts.trim()) return parts.trim();
  }
  try {
    return JSON.stringify(data).slice(0, 400);
  } catch {
    return "Provider returned error";
  }
}
