import { NextRequest, NextResponse } from "next/server";
import { analyzeVisionFrames } from "@/lib/server/analyzeVision";
import { requireUserWithQuota } from "@/lib/server/gentGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AnalyzeBody {
  frames?: string[];
  frameTimesSec?: number[];
  durationSec?: number;
  name?: string;
  question?: string;
  modelId?: string;
}

/**
 * Analyse des images extraites d'une vidéo (frames) via un modèle vision.
 * Le client envoie des data:image/jpeg — jamais le fichier vidéo brut.
 */
export async function POST(req: NextRequest) {
  // Analyse vision : le nombre d'images n'est pas borné, chacune multiplie le
  // coût du tour. Route ouverte à tous jusqu'ici.
  const garde = await requireUserWithQuota("video");
  if (!garde.ok) return garde.response;

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (!frames.length) {
    return NextResponse.json({ error: "missing_frames" }, { status: 400 });
  }

  const result = await analyzeVisionFrames({
    frames,
    frameTimesSec: Array.isArray(body.frameTimesSec) ? body.frameTimesSec : undefined,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
    videoName: typeof body.name === "string" ? body.name : undefined,
    question: typeof body.question === "string" ? body.question : undefined,
    modelId: typeof body.modelId === "string" ? body.modelId : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ analysis: result.analysis });
}
