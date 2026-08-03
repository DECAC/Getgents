import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import {
  describeShareLinksFailure,
  getShareLink,
  incrementRefreshCount,
  recordShareEvent,
  TOKEN_RE,
} from "@/lib/server/shareLinks";
import { canRefresh, shareLinkState } from "@/lib/shareLink";
import { refreshPinnedArtefact } from "@/lib/server/pinnedArtefact";
import { withoutSessionContext } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Params {
  params: { token: string };
}

/**
 * Régénération de l'artefact figé demandée par un destinataire de lien.
 *
 * Le client n'envoie QUE les valeurs des entrées : la mission (« prompt figé »)
 * et le prompt système sont relus en base. Chaque appel consomme un crédit du
 * quota `max_refresh` — sans lui, un lien partagé serait un générateur d'appels
 * LLM facturés ouvert à tous.
 */
export async function POST(req: Request, { params }: Params) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let link;
  try {
    link = await getShareLink(token);
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
  if (!link) return NextResponse.json({ error: "link_not_found" }, { status: 404 });

  if (!canRefresh(link)) {
    const state = shareLinkState(link);
    return NextResponse.json(
      {
        error: "refresh_unavailable",
        note:
          state === "exhausted"
            ? "Nombre maximal de mises à jour atteint pour ce lien."
            : state === "revoked"
              ? "Ce lien a été révoqué."
              : state === "expired"
                ? "Ce lien a expiré."
                : "La mise à jour n'est pas autorisée sur ce lien.",
      },
      { status: 403 }
    );
  }

  let body: { inputs?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data, error } = await supabase
    .from("published_gents")
    .select("espace")
    .eq("id", link.gentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "gent_not_found" }, { status: 404 });

  let espace = data.espace as Espace;
  if (body.inputs && espace.pinnedArtefact) {
    const inputs = espace.pinnedArtefact.inputs.map((i) =>
      body.inputs && i.id in body.inputs ? { ...i, value: body.inputs[i.id] } : i
    );
    espace = { ...espace, pinnedArtefact: { ...espace.pinnedArtefact, inputs } };
  }

  // Le visiteur externe n'a ni mémoire ni fichiers au sens du gent (aucune
  // session préalable) : seules ses valeurs d'entrées, déjà appliquées
  // ci-dessus, doivent nourrir sa génération — jamais la mémoire ou les
  // documents persistés sur l'espace, qui appartiennent au créateur ou à
  // d'autres utilisateurs.
  const forGeneration = withoutSessionContext(espace);

  // Le crédit est consommé avant la génération : un échec LLM ne doit pas
  // offrir de tentatives illimitées.
  await incrementRefreshCount(token);
  const result = await refreshPinnedArtefact(forGeneration, "lien");

  // Ne JAMAIS réécrire published_gents avec le résultat du visiteur :
  // - ses entrées (CV, LinkedIn…) et son dashboard sont personnels ;
  // - l'upsert gonflait la ligne serveur et allongeait la requête jusqu'à
  //   faire tomber la connexion (« Failed to fetch ») après 1–2 min de LLM.
  // Le dashboard est renvoyé au navigateur du destinataire uniquement
  // (comme /api/artefact/preview côté builder).
  await recordShareEvent(token, "refresh", result.ok ? "ok" : result.note);

  return NextResponse.json({
    ok: result.ok,
    note: result.note,
    dashboard: result.pinned.dashboard ?? null,
    run: result.run ?? null,
  });
}
