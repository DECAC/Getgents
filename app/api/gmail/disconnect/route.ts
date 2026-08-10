import { NextRequest, NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/server/gmail";

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
  await disconnectGmail(gentId);
  return NextResponse.json({ ok: true });
}
