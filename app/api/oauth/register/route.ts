import { NextResponse } from "next/server";
import { validerInscription } from "@/lib/oauthMcp";
import { inscrireClient } from "@/lib/server/oauthMcp";
import { ENTETES_CORS } from "@/lib/server/mcpTransport";

/**
 * Enregistrement dynamique de client (RFC 7591). Ouvert par nature : Claude
 * s'inscrit tout seul, sans compte. S'inscrire ne donne AUCUN droit — il
 * faut encore qu'un commercial connecté consente, sur une page qui affiche
 * le nom de l'application et le site où partira le code.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const corps = await req.json().catch(() => null);
  const v = validerInscription(corps);
  if (!v.ok) return NextResponse.json({ error: v.erreur, error_description: v.description }, { status: 400, headers: ENTETES_CORS });
  try {
    const c = await inscrireClient(v.nom, v.adressesRetour);
    return NextResponse.json(
      {
        client_id: c.clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: c.nom,
        redirect_uris: c.adressesRetour,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201, headers: { "Cache-Control": "no-store", ...ENTETES_CORS } }
    );
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:oauth-mcp", event: "inscription_echouee", detail: (e as Error).message }));
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: ENTETES_CORS });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ENTETES_CORS });
}
