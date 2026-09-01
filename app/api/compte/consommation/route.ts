import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { USAGE_LIMITS, windowStart, type UsageKind } from "@/lib/rateLimit";
import { contexteForUser } from "@/lib/server/openRouterKey";

export const dynamic = "force-dynamic";

/**
 * Consommation de la fenêtre horaire en cours.
 *
 * Un plafond invisible qui refuse en 429 est vécu comme une panne, pas comme
 * une règle : la personne ne sait ni ce qu'elle a consommé, ni quand elle
 * pourra reprendre. On le montre donc — et on dit clairement qu'il ne
 * s'applique plus dès qu'une clé personnelle est branchée.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const ctx = await contexteForUser(auth.user.id);
  const plafonne = ctx.source === "plateforme";

  const compteurs: Record<UsageKind, { utilise: number; plafond: number }> = {
    llm: { utilise: 0, plafond: USAGE_LIMITS.llm },
    image: { utilise: 0, plafond: USAGE_LIMITS.image },
    video: { utilise: 0, plafond: USAGE_LIMITS.video },
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data } = await supabase
      .from("usage_counters")
      .select("kind, count")
      .eq("user_id", auth.user.id)
      .eq("window_start", windowStart(new Date()));

    for (const ligne of data ?? []) {
      const kind = ligne.kind as UsageKind;
      if (kind in compteurs) compteurs[kind].utilise = (ligne.count as number) ?? 0;
    }
  }

  return NextResponse.json({ plafonne, source: ctx.source, compteurs });
}
