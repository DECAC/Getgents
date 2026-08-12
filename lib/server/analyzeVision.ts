import { resolveVisionModelId } from "@/lib/visionModels";
import { MAX_VIDEO_FRAMES } from "@/lib/extractVideoFrames";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

export interface VisionAnalyzeInput {
  frames: string[];
  frameTimesSec?: number[];
  durationSec?: number;
  videoName?: string;
  question?: string;
  modelId?: string;
}

function isAllowedFrameUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

/** Analyse une série d'images (frames vidéo) via un modèle vision OpenRouter. */
export async function analyzeVisionFrames(input: VisionAnalyzeInput): Promise<{ analysis: string } | { error: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { error: "Clé API OpenRouter absente." };

  const frames = (input.frames ?? []).filter(isAllowedFrameUrl).slice(0, MAX_VIDEO_FRAMES);
  if (!frames.length) return { error: "Aucune image valide à analyser." };

  const model = resolveVisionModelId(input.modelId);
  const title = input.videoName?.trim() || "vidéo";
  const duration =
    typeof input.durationSec === "number" && input.durationSec > 0
      ? `${Math.round(input.durationSec)} secondes`
      : "durée inconnue";
  const times = input.frameTimesSec ?? frames.map((_, i) => i);

  const intro =
    `Tu analyses une vidéo (« ${title} », ${duration}). ` +
    `${frames.length} images ont été extraites à différents instants (en secondes : ${times.join(", ")}). ` +
    "Décris ce qui se passe : sujet, actions, personnes ou objets visibles, texte à l'écran, lieux, ambiance, évolution entre les images. " +
    "Réponds en français, de façon structurée et factuelle. Si une information n'est pas visible, dis-le.";

  const userQuestion = input.question?.trim();
  const textBlock = userQuestion ? `${intro}\n\nQuestion de l'utilisateur : ${userQuestion}` : intro;

  const content: { type: string; text?: string; image_url?: { url: string } }[] = [
    { type: "text", text: textBlock },
    ...frames.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://getgents.app",
      "X-Title": "Getgents",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    }),
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const err =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.error?.message === "string"
          ? data.error.message
          : `Erreur du modèle vision (${upstream.status}).`;
    return { error: `${err} [modèle : ${model}]` };
  }

  const data = await upstream.json();
  const analysis = (data?.choices?.[0]?.message?.content as string | undefined)?.trim();
  if (!analysis) return { error: "Le modèle vision n'a renvoyé aucune analyse." };
  return { analysis };
}
