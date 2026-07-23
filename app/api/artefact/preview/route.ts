import { NextResponse } from "next/server";
import { refreshPinnedArtefact } from "@/lib/server/pinnedArtefact";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Aperçu de l'artefact figé côté BUILDER, avant publication : régénère le
 * tableau de bord à partir de l'espace fourni dans le corps (dérivé du brouillon
 * via draftToEspace), SANS toucher la base — rien n'est persisté, contrairement
 * à /api/artefact/refresh qui lit/écrit le gent publié dans Supabase.
 */
export async function POST(req: Request) {
  let body: { espace?: Espace };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const espace = body.espace;
  if (!espace || typeof espace !== "object" || !espace.pinnedArtefact) {
    return NextResponse.json({ error: "invalid_espace" }, { status: 400 });
  }

  const result = await refreshPinnedArtefact(espace);
  return NextResponse.json({
    ok: result.ok,
    note: result.note,
    dashboard: result.pinned.dashboard ?? null,
  });
}
