import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { refreshPinnedArtefact } from "@/lib/server/pinnedArtefact";
import type { Espace } from "@/lib/types";
import { consumeQuota, requireGentAccess } from "@/lib/server/gentGuard";

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

  let body: { gentId?: string; inputs?: Record<string, string>; espace?: Espace };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const gentId = body.gentId;
  if (!gentId || !ID_RE.test(gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  // Cette route ÉCRIT dans published_gents, et n'avait aucune garde : on
  // pouvait remplacer le contenu du gent de n'importe qui, ce qui ouvrait
  // aussi la voie au XSS stocké corrigé au lot 1.
  const acces = await requireGentAccess(gentId, "write");
  if (!acces.ok) return acces.response;

  const quota = await consumeQuota(acces.value.user.id, "llm");
  if (!quota.ok) return quota.response;

  let espace: Espace | null = null;
  if (supabase) {
    const { data, error } = await supabase.from("published_gents").select("espace").eq("id", gentId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) espace = body.espace ?? null;
    else espace = data.espace as Espace;
  } else {
    espace = body.espace ?? null;
  }

  if (!espace) {
    return NextResponse.json(
      {
        error: supabase ? "not_found" : "supabase_not_configured",
        hint: "Sans Supabase, envoyez l'espace courant dans le corps de la requête.",
      },
      { status: supabase ? 404 : 503 }
    );
  }

  // Mise à jour éventuelle des entrées avant génération.
  if (body.inputs && espace.pinnedArtefact) {
    const inputs = espace.pinnedArtefact.inputs.map((i) =>
      body.inputs && i.id in body.inputs ? { ...i, value: body.inputs[i.id] } : i
    );
    espace = { ...espace, pinnedArtefact: { ...espace.pinnedArtefact, inputs } };
  }

  const result = await refreshPinnedArtefact(espace);
  const updated: Espace = { ...espace, pinnedArtefact: result.pinned };

  if (supabase) {
    const { error: upErr } = await supabase.from("published_gents").upsert({ id: gentId, espace: updated });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: result.ok,
    note: result.note,
    pinnedArtefact: result.pinned,
    persisted: !!supabase,
  });
}
