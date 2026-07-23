import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/server/supabase";
import { refreshPinnedArtefact } from "@/lib/server/pinnedArtefact";
import type { Espace, PinnedArtefact } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

/**
 * Contexte minimal envoyé par le client pour générer l'artefact figé sans
 * dépendre de Supabase — la génération ne nécessite qu'OpenRouter. La
 * persistance (Supabase) reste optionnelle : elle n'a lieu que si elle est
 * configurée et que le gent existe en base ; sinon le client persiste seul
 * (localStorage). C'est ce qui rend la mini-app utilisable en preview.
 */
interface RefreshBody {
  gentId?: string;
  espace?: Pick<Espace, "name" | "systemPrompt" | "profile" | "webSearch" | "chatModelId" | "pinnedArtefact">;
  inputs?: Record<string, string>;
}

export async function POST(req: Request) {
  let body: RefreshBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 1) Reconstituer l'espace de travail : depuis le corps (client, sans DB) ou
  //    depuis Supabase si seul un gentId est fourni.
  let espace: Espace | null = null;
  if (body.espace?.pinnedArtefact) {
    espace = {
      name: body.espace.name ?? "Gent",
      systemPrompt: body.espace.systemPrompt,
      profile: body.espace.profile,
      webSearch: body.espace.webSearch,
      chatModelId: body.espace.chatModelId,
      pinnedArtefact: body.espace.pinnedArtefact,
    } as Espace;
  } else if (body.gentId) {
    if (!ID_RE.test(body.gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
    const { data, error } = await supabase.from("published_gents").select("espace").eq("id", body.gentId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    espace = data.espace as Espace;
  }

  if (!espace?.pinnedArtefact?.enabled) {
    return NextResponse.json({ error: "no_pinned_artefact" }, { status: 400 });
  }

  // Mise à jour éventuelle des entrées avant génération.
  if (body.inputs) {
    const inputs = espace.pinnedArtefact.inputs.map((i) =>
      body.inputs && i.id in body.inputs ? { ...i, value: body.inputs![i.id] } : i
    );
    espace = { ...espace, pinnedArtefact: { ...espace.pinnedArtefact, inputs } };
  }

  const result = await refreshPinnedArtefact(espace);
  const pinned: PinnedArtefact = result.pinned;

  // 2) Persistance serveur best-effort : uniquement si Supabase est configuré
  //    ET que le gent existe déjà en base. Sinon on ne bloque pas — le client
  //    conserve le résultat (localStorage / mémoire).
  if (result.ok && body.gentId && ID_RE.test(body.gentId) && isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data } = await supabase.from("published_gents").select("espace").eq("id", body.gentId).maybeSingle();
      if (data) {
        const stored = data.espace as Espace;
        await supabase
          .from("published_gents")
          .upsert({ id: body.gentId, espace: { ...stored, pinnedArtefact: pinned } });
      }
    }
  }

  return NextResponse.json({ ok: result.ok, note: result.note, pinnedArtefact: pinned });
}
