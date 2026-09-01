import { NextRequest, NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/server/gmail";
import { requireGentOrDraftAccess } from "@/lib/server/gentGuard";

export async function POST(req: NextRequest) {
  let body: { gentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const gentId = body.gentId?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "gentId requis." }, { status: 400 });
  }
  // Débrancher le compte Google d'un gent qui n'est pas le sien couperait
  // ses envois sans qu'il comprenne pourquoi.
  const acces = await requireGentOrDraftAccess(gentId, "admin");
  if (!acces.ok) return acces.response;

  await disconnectGmail(gentId);
  return NextResponse.json({ ok: true });
}
