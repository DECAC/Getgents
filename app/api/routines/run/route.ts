import { NextResponse } from "next/server";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { isRoutineDue, runRoutine } from "@/lib/server/routineRunner";
import type { Espace } from "@/lib/types";
import { consommerPourVisiteur, requireGentOrDraftAccess } from "@/lib/server/gentGuard";
import { contexteForUser } from "@/lib/server/openRouterKey";

export const dynamic = "force-dynamic";
// Un run de veille (recherche web + synthèse) peut être long.
export const maxDuration = 300;

type RunResult = { id: string; status: string; espace?: Espace };

/** Exécute les routines dues de tous les gents (ou d'un seul si forced). */
async function runBatch(
  forced: string | null,
  fallbackEspace: Espace | null = null
): Promise<{ ran: number; results: RunResult[]; persisted: boolean }> {
  const supabase = getSupabaseAdmin();

  type Row = { id: string; ownerId: string | null; espace: Espace };
  let rows: Row[] = [];

  if (supabase) {
    // Une routine s'exécute pour de vrais destinataires : elle doit tourner
    // sur la version DIFFUSÉE, pas sur la version de travail que le créateur
    // remue en Preview.
    const query = supabase.from("published_gents").select(`id, owner_id, ${DIFFUSED_COLUMNS}`);
    const { data, error } = forced ? await query.eq("id", forced) : await query;
    if (error) throw new Error(error.message);
    rows = (data ?? [])
      .map((row) => {
        const espace = diffusedEspace(row as { espace?: unknown; diffused?: unknown });
        const r = row as { id: string; owner_id?: string | null };
        return espace ? { id: r.id, ownerId: r.owner_id ?? null, espace } : null;
      })
      .filter((r): r is Row => r !== null);
  } else if (forced && fallbackEspace) {
    rows = [{ id: forced, ownerId: null, espace: fallbackEspace }];
  } else if (forced) {
    throw new Error("supabase_not_configured");
  } else {
    throw new Error("supabase_not_configured");
  }

  const results: RunResult[] = [];
  for (const row of rows) {
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

    // Un contexte PAR GENT : le cron traite les routines de tous les comptes,
    // et chacun paie les siennes. Un contexte global ferait payer la
    // plateforme pour un builder qui a branché sa clé, ou pire, ferait passer
    // les appels d'un compte sur la clé d'un autre.
    const ctx = await contexteForUser(row.ownerId);
    const quota = await consommerPourVisiteur(ctx, "llm");
    if (!quota.ok) {
      results.push({ id: row.id, status: "plafond horaire du propriétaire atteint" });
      continue;
    }

    const run = await runRoutine(espace, routine, ctx, row.id);
    if (supabase) {
      // La note produite rejoint la version diffusée — écrire dans `espace`
      // écraserait la configuration en cours d'édition du créateur.
      const { error: upsertError } = await supabase
        .from("published_gents")
        .update({ diffused: run.espace })
        .eq("id", row.id);
      results.push({
        id: row.id,
        status: upsertError ? `run ${run.ok ? "ok" : "ko"} mais écriture échouée : ${upsertError.message}` : run.note,
      });
    } else {
      results.push({ id: row.id, status: run.note, espace: run.espace });
    }
  }
  return { ran: results.length, results, persisted: !!supabase };
}

/**
 * Cette route déclenche de vraies générations LLM et de vrais envois
 * (WhatsApp, e-mail). Sans secret configuré, elle passait en mode ouvert — un
 * oubli de variable sur l'hébergeur suffisait à l'offrir à Internet, sans
 * aucune trace. En production on échoue donc FERMÉ, avec un journal qui nomme
 * la variable manquante : une routine qui ne part plus est un incident
 * diagnosticable, une route ouverte ne l'est pas.
 */
function checkCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        JSON.stringify({
          tag: "getgents:routines",
          event: "cron_secret_missing",
          detail: "CRON_SECRET n'est pas défini : exécution refusée en production.",
        })
      );
      return false;
    }
    return true; // développement local
  }
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
  let body: { gentId?: string; espace?: Espace } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide accepté
  }
  const forced = typeof body.gentId === "string" ? body.gentId : null;
  const fallbackEspace = body.espace && typeof body.espace === "object" ? body.espace : null;
  // Fournir un `gentId` suffisait à contourner CRON_SECRET : n'importe qui
  // pouvait faire tourner en boucle la routine d'un gent quelconque, avec les
  // appels LLM et les envois réels (WhatsApp, e-mail) que cela déclenche.
  //
  // Deux appelants légitimes, et deux seulement : le cron de l'hébergeur, qui
  // porte le secret et balaie tous les gents ; et le créateur qui clique
  // « Exécuter maintenant » sur SON gent, ce que le contrôle de propriétaire
  // vérifie maintenant nommément.
  if (!checkCronSecret(req)) {
    if (!forced) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const acces = await requireGentOrDraftAccess(forced, "write");
    if (!acces.ok) return acces.response;
  }
  try {
    return NextResponse.json(await runBatch(forced, fallbackEspace));
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json(
      {
        error: msg,
        hint:
          msg === "supabase_not_configured"
            ? "Sans Supabase, publiez le gent puis renvoyez son espace courant dans le corps de la requête."
            : undefined,
      },
      { status: msg === "supabase_not_configured" ? 503 : 500 }
    );
  }
}
