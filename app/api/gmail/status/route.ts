import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/server/gmail";
import { requireGentOrDraftAccess } from "@/lib/server/gentGuard";

export async function GET(req: NextRequest) {
  const gentId = req.nextUrl.searchParams.get("gentId")?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "Paramètre gentId requis." }, { status: 400 });
  }
  // L'état de connexion révèle l'adresse Google associée au gent.
  const acces = await requireGentOrDraftAccess(gentId, "read");
  if (!acces.ok) return acces.response;

  const status = await getConnectionStatus(gentId);
  return NextResponse.json(status);
}
