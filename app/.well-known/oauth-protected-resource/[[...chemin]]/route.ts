import { NextResponse } from "next/server";
import { metadonneesRessource, origineDeRequete } from "@/lib/oauthMcp";
import { ENTETES_CORS } from "@/lib/server/mcpTransport";

/**
 * Métadonnées de la ressource protégée (RFC 9728). Le client les cherche à
 * la racine ou suffixées du chemin de la ressource
 * (`/.well-known/oauth-protected-resource/api/mcp`) : les deux répondent.
 */
export function GET(req: Request) {
  return NextResponse.json(metadonneesRessource(origineDeRequete(req.url, req.headers)), {
    headers: { "Cache-Control": "public, max-age=300", ...ENTETES_CORS },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ENTETES_CORS });
}
