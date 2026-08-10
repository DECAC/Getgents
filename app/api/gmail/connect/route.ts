import { NextRequest, NextResponse } from "next/server";
import { consentUrl, isGmailConfigured } from "@/lib/server/gmail";

export async function GET(req: NextRequest) {
  const gentId = req.nextUrl.searchParams.get("gentId")?.trim();
  if (!gentId) {
    return NextResponse.json({ error: "Paramètre gentId requis." }, { status: 400 });
  }
  if (!isGmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Connecteur Gmail non configuré : définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sur l'hébergement (Google Cloud Console).",
      },
      { status: 500 }
    );
  }
  const origin = req.nextUrl.origin;
  const result = consentUrl(gentId, origin);
  if ("error" in result) {
    return NextResponse.json(JSON.parse(result.error), { status: 500 });
  }
  return NextResponse.redirect(result.url);
}
