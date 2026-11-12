import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { origineDeRequete } from "@/lib/oauthMcp";
import { repondreMcp } from "@/lib/server/mcpTransport";

/**
 * Connecteur MCP de partage d'artefacts — clé d'ESSAI (phase 0).
 *
 * Adresse : `/api/mcp/<MCP_ESSAI_CLE>`. Quiconque connaît la clé peut
 * publier, sans compte. Remplacée par /api/mcp (OAuth, phase 1) ; à RETIRER
 * dès que le connecteur OAuth est validé dans Claude.
 */

export const dynamic = "force-dynamic";

function cleValide(cle: string): boolean {
  const attendue = process.env.MCP_ESSAI_CLE ?? "";
  // Une clé courte se devine : en dessous de 32 caractères, le connecteur reste fermé.
  if (attendue.length < 32) return false;
  const a = Buffer.from(cle);
  const b = Buffer.from(attendue);
  return a.length === b.length && timingSafeEqual(a, b);
}

const introuvable = () => new NextResponse(null, { status: 404 });

export async function POST(req: Request, { params }: { params: { cle: string } }) {
  // Clé fausse ou connecteur non configuré : 404, sans rien révéler.
  if (!cleValide(params.cle)) return introuvable();
  return repondreMcp(req, origineDeRequete(req.url, req.headers), null);
}

export async function GET(_req: Request, { params }: { params: { cle: string } }) {
  if (!cleValide(params.cle)) return introuvable();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(_req: Request, { params }: { params: { cle: string } }) {
  if (!cleValide(params.cle)) return introuvable();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
