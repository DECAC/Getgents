import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { refreshPinnedArtefact } from "@/lib/server/pinnedArtefact";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

/**
 * Rafraîchit l'artefact figé d'un gent : régénère son tableau de bord côté
 * serveur et persiste. Accepte des `inputs` optionnels ({id: value}) pour
 * mettre à jour les entrées utilisateur (LinkedIn, CV…) avant la génération.
 */
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let body: { gentId?: string; inputs?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const gentId = body.gentId;
  if (!gentId || !ID_RE.test(gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const { data, error } = await supabase.from("published_gents").select("espace").eq("id", gentId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let espace = data.espace as Espace;
  // Mise à jour éventuelle des entrées avant génération.
  if (body.inputs && espace.pinnedArtefact) {
    const inputs = espace.pinnedArtefact.inputs.map((i) =>
      body.inputs && i.id in body.inputs ? { ...i, value: body.inputs[i.id] } : i
    );
    espace = { ...espace, pinnedArtefact: { ...espace.pinnedArtefact, inputs } };
  }

  const result = await refreshPinnedArtefact(espace);
  const updated: Espace = { ...espace, pinnedArtefact: result.pinned };
  const { error: upErr } = await supabase.from("published_gents").upsert({ id: gentId, espace: updated });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: result.ok, note: result.note, pinnedArtefact: result.pinned });
}
