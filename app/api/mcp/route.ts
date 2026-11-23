import { NextResponse } from "next/server";
import { enteteAuthentification, origineDeRequete, SCOPE_PARTAGE } from "@/lib/oauthMcp";
import { verifierAcces } from "@/lib/server/oauthMcp";
import { corpsPublic } from "@/lib/mcpPartage";
import { ENTETES_CORS, lireCorpsMcp, repondreMcp, repondreSansJeton } from "@/lib/server/mcpTransport";

/**
 * Connecteur MCP de partage d'artefacts — PHASE 1 (OAuth).
 *
 * Adresse à déclarer dans Claude : `https://getgents.ai/api/mcp`, sans clé.
 * Sans jeton, `initialize`, `tools/list` et `ping` répondent (découverte, 23/11 :
 * annuaires) ; tout le reste — `tools/call` en tête — reçoit 401 et son en-tête
 * `WWW-Authenticate`, qui envoient le client vers les métadonnées (/.well-known/oauth-protected-resource), d'où
 * il s'inscrit et fait consentir le commercial. Chaque partage est alors
 * rattaché à SON compte.
 */

export const dynamic = "force-dynamic";

async function porteur(req: Request) {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  return m ? verifierAcces(m[1]) : null;
}

function refus(origine: string, jetonPresent: boolean) {
  return NextResponse.json(
    { error: jetonPresent ? "invalid_token" : "unauthorized", error_description: "Connexion à Getgents requise." },
    {
      status: 401,
      headers: { "WWW-Authenticate": enteteAuthentification(origine, jetonPresent ? "invalid_token" : undefined), ...ENTETES_CORS },
    }
  );
}

export async function POST(req: Request) {
  const origine = origineDeRequete(req.url, req.headers);
  const p = await porteur(req);
  const lu = await lireCorpsMcp(req);
  if ("reponse" in lu) return lu.reponse;
  if (!p || !p.scope.split(" ").includes(SCOPE_PARTAGE)) {
    // Découvrir sans se connecter (initialize, tools/list, ping) ; tout le reste exige le jeton.
    // Un jeton PRÉSENT mais invalide reste refusé : le client doit le renouveler.
    if (!req.headers.has("authorization") && corpsPublic(lu.corps)) return repondreSansJeton(lu.corps, origine, req.headers.get("user-agent"));
    return refus(origine, req.headers.has("authorization"));
  }
  return repondreMcp(req, origine, { userId: p.userId, clientId: p.clientId }, lu.corps);
}

export async function GET(req: Request) {
  const origine = origineDeRequete(req.url, req.headers);
  if (!(await porteur(req))) return refus(origine, req.headers.has("authorization"));
  return new NextResponse(null, { status: 405, headers: { Allow: "POST", ...ENTETES_CORS } });
}

export async function DELETE(req: Request) {
  return GET(req);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ENTETES_CORS });
}
