import { NextResponse } from "next/server";
import { metadonneesServeur, origineDeRequete } from "@/lib/oauthMcp";
import { ENTETES_CORS } from "@/lib/server/mcpTransport";

/** Métadonnées du serveur d'autorisation (RFC 8414) : où s'inscrire, consentir, obtenir un jeton. */
export function GET(req: Request) {
  return NextResponse.json(metadonneesServeur(origineDeRequete(req.url, req.headers)), {
    headers: { "Cache-Control": "public, max-age=300", ...ENTETES_CORS },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ENTETES_CORS });
}
