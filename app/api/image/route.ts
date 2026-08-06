import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

interface ImageBody {
  prompt?: string;
  modelId?: string;
}

/**
 * Génère une image via un modèle multimodal OpenRouter (ex. google/nanobanana)
 * distinct du modèle conversationnel du gent. Le modèle de chat ne peut pas
 * produire d'image lui-même : cette route est appelée côté client quand le
 * gent émet un signal <!--IMAGE: {...}--> (voir lib/imageSignal.ts).
 */
export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Clé API OpenRouter absente." }, { status: 500 });
  }

  let body: ImageBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  const modelId = body.modelId?.trim();
  if (!prompt || !modelId) {
    return NextResponse.json({ error: "missing_prompt_or_model" }, { status: 400 });
  }

  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://getgents.app",
      "X-Title": "Getgents",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const errText =
      typeof data?.error === "string" ? data.error : typeof data?.error?.message === "string" ? data.error.message : "Erreur du modèle image.";
    return NextResponse.json({ error: errText }, { status: upstream.status });
  }

  const data = await upstream.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const imageUrl = extractImageUrl(msg);
  if (!imageUrl) {
    return NextResponse.json({ error: "Le modèle n'a renvoyé aucune image." }, { status: 502 });
  }

  return NextResponse.json({ imageUrl });
}

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
  return null;
}
