import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { checkAppAccess, APP_ACCESS_HINT } from "@/lib/server/appAccess";

export const dynamic = "force-dynamic";

/** Liste tous les brouillons du builder — map id → draft (même forme que le cache localStorage). */
export async function GET(req: Request) {
  if (!checkAppAccess(req)) {
    return NextResponse.json({ error: "unauthorized", hint: APP_ACCESS_HINT }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data, error } = await supabase.from("gent_drafts").select("id, draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const drafts: Record<string, unknown> = {};
  for (const row of data ?? []) drafts[row.id] = row.draft;
  return NextResponse.json({ drafts });
}
