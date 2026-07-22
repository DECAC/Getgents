import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isRoutineDue, runRoutine } from "@/lib/server/routineRunner";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";
// Un run de veille (recherche web + synthèse) peut être long.
export const maxDuration = 300;

/** Exécute les routines dues de tous les gents (ou d'un seul si forced). */
async function runBatch(forced: string | null): Promise<{ ran: number; results: { id: string; status: string }[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const query = supabase.from("published_gents").select("id, espace");
  const { data, error } = forced ? await query.eq("id", forced) : await query;
  if (error) throw new Error(error.message);

  const results: { id: string; status: string }[] = [];
  for (const row of data ?? []) {
    const espace = row.espace as Espace;
    const routine = espace.routine;
    if (!routine) {
      if (forced) results.push({ id: row.id, status: "aucune routine configurée" });
      continue;
    }
    if (!forced && !isRoutineDue(routine)) continue;
    if (forced && !routine.mission.trim()) {
      results.push({ id: row.id, status: "mission vide" });
      continue;
    }

    const run = await runRoutine(espace, routine);
    const { error: upsertError } = await supabase.from("published_gents").upsert({ id: row.id, espace: run.espace });
    results.push({
      id: row.id,
      status: upsertError ? `run ${run.ok ? "ok" : "ko"} mais écriture échouée : ${upsertError.message}` : run.note,
    });
  }
  return { ran: results.length, results };
}

function checkCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // pas de secret configuré → pas de protection (dev)
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

/**
 * GET : mode cron (Vercel Cron appelle en GET avec Authorization: Bearer
 * CRON_SECRET). Parcourt tous les gents et exécute les routines dues.
 */
export async function GET(req: Request) {
  if (!checkCronSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runBatch(null));
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === "supabase_not_configured" ? 503 : 500 });
  }
}

/**
 * POST : run forcé d'un gent précis (bouton « Exécuter maintenant » du
 * builder) via { gentId }. Sans gentId, équivaut au mode cron (protégé par
 * le secret si configuré).
 */
export async function POST(req: Request) {
  let body: { gentId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide accepté
  }
  const forced = typeof body.gentId === "string" ? body.gentId : null;
  if (!forced && !checkCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runBatch(forced));
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === "supabase_not_configured" ? 503 : 500 });
  }
}
