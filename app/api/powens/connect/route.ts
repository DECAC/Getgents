import { NextRequest, NextResponse } from "next/server";
import { connectWebviewUrl } from "@/lib/server/powens";

// Redirige le créateur vers la webview Powens pour lier une banque SANDBOX
// au compte utilisateur géré côté serveur. Aucun secret ne transite par le
// navigateur : seul un code temporaire à usage unique est mis dans l'URL.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const result = await connectWebviewUrl(`${origin}/builder`);
  if ("error" in result) {
    return NextResponse.json(JSON.parse(result.error), { status: 500 });
  }
  return NextResponse.redirect(result.url);
}
