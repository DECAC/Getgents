import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/server/gmail";

export async function GET(req: NextRequest) {
  const gentId = req.nextUrl.searchParams.get("gentId")?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "Paramètre gentId requis." }, { status: 400 });
  }
  const status = await getConnectionStatus(gentId);
  return NextResponse.json(status);
}
