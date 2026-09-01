import { NextResponse } from "next/server";
import type { Espace } from "@/lib/types";
import { generateStarters } from "@/lib/server/starters";
import { requireUserWithQuota } from "@/lib/server/gentGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Génère les « déclencheurs » d'un gent conversationnel : cinq questions
 * d'amorce reflétant ses capacités réelles. Appelée par le créateur depuis son
 * espace ; le résultat est ensuite persisté côté client, donc un seul appel
 * par gent. Les destinataires d'un lien passent par
 * /api/links/[token]/starters, qui écrit dans la version diffusée.
 */
export async function POST(req: Request) {
  // Génère cinq amorces via le modèle : facturé, donc réservé aux comptes.
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;


  let body: { espace?: Espace };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const espace = body.espace;
  if (!espace || typeof espace !== "object") {
    return NextResponse.json({ error: "missing_espace" }, { status: 400 });
  }

  const starters = await generateStarters(espace, garde.value.ctx);
  return NextResponse.json({ starters });
}
