import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { checkAppAccess } from "@/lib/server/appAccess";

export const dynamic = "force-dynamic";

/** Liste tous les gents publiés — map id → espace (même forme que le cache localStorage). */
export async function GET(req: Request) {
  if (!checkAppAccess(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data, error } = await supabase.from("published_gents").select("id, espace");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gents: Record<string, unknown> = {};
  for (const row of data ?? []) gents[row.id] = row.espace;
  return NextResponse.json({ gents });
}
