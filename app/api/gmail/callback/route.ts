import { NextRequest, NextResponse } from "next/server";
import { decodeOAuthState, handleOAuthCallback } from "@/lib/server/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    const gentId = state ? decodeOAuthState(state)?.gentId : null;
    const dest = gentId
      ? `/builder/${gentId}?tab=connectors&gmail=error&reason=${encodeURIComponent(oauthError)}`
      : `/builder?gmail=error&reason=${encodeURIComponent(oauthError)}`;
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Paramètres OAuth manquants (code ou state)." }, { status: 400 });
  }

  const parsed = decodeOAuthState(state);
  if (!parsed) {
    return NextResponse.json({ error: "État OAuth invalide ou expiré — relancez la connexion." }, { status: 400 });
  }

  const result = await handleOAuthCallback(code, parsed.gentId, req.nextUrl.origin);
  if ("error" in result) {
    return NextResponse.redirect(
      new URL(
        `/builder/${parsed.gentId}?tab=connectors&gmail=error&reason=${encodeURIComponent(result.error)}`,
        req.nextUrl.origin
      )
    );
  }

  const emailParam = result.email ? `&email=${encodeURIComponent(result.email)}` : "";
  return NextResponse.redirect(
    new URL(`/builder/${parsed.gentId}?tab=connectors&gmail=connected${emailParam}`, req.nextUrl.origin)
  );
}
