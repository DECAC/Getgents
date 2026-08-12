import { NextRequest, NextResponse } from "next/server";
import { generateImageFromPrompt } from "@/lib/server/generateImage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface ImageBody {
  prompt?: string;
  modelId?: string;
}

/**
 * Génère une image via un modèle multimodal OpenRouter
 * (ex. google/gemini-2.5-flash-image = Nanobanana).
 */
export async function POST(req: NextRequest) {
  let body: ImageBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "missing_prompt" }, { status: 400 });
  }

  const result = await generateImageFromPrompt(prompt, body.modelId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ imageUrl: result.imageUrl, modelId: body.modelId });
}
