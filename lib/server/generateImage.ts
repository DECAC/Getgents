import { resolveImageModelId } from "@/lib/imageModels";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

function extractImageUrl(msg: Record<string, unknown>): string | null {
  const images = msg.images as { image_url?: { url?: string } }[] | undefined;
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img?.image_url?.url) return img.image_url.url;
    }
  }
  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content as { type?: string; image_url?: { url?: string } }[]) {
      if (part?.type === "image_url" && part.image_url?.url) return part.image_url.url;
    }
  }
  if (typeof content === "string") {
    const m = content.match(/!\[[^\]]*\]\((data:image\/[^)]+|https:[^)]+)\)/);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Génère une image via OpenRouter (Nanobanana / Gemini Flash Image par défaut). */
export async function generateImageFromPrompt(
  prompt: string,
  modelId?: string
): Promise<{ imageUrl: string } | { error: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { error: "Clé API OpenRouter absente." };

  const resolvedModel = resolveImageModelId(modelId);
  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://getgents.app",
      "X-Title": "Getgents",
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [{ role: "user", content: prompt.trim() }],
      modalities: ["image", "text"],
    }),
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const errText =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.error?.message === "string"
          ? data.error.message
          : `Erreur du modèle image (${upstream.status}).`;
    return { error: `${errText} [modèle : ${resolvedModel}]` };
  }

  const data = await upstream.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const imageUrl = extractImageUrl(msg);
  if (!imageUrl) {
    return { error: `Le modèle n'a renvoyé aucune image. [modèle : ${resolvedModel}]` };
  }
  return { imageUrl };
}
