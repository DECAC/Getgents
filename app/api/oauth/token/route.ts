import { NextResponse } from "next/server";
import { pkceValide } from "@/lib/oauthMcp";
import { consommerCode, emettreJetons, renouveler } from "@/lib/server/oauthMcp";
import { ENTETES_CORS } from "@/lib/server/mcpTransport";

/**
 * Point d'obtention des jetons (OAuth 2.1). Client PUBLIC, sans secret : la
 * preuve est le `code_verifier` PKCE, que seul celui qui a lancé la demande
 * connaît. Codes à usage unique, renouvellement avec rotation.
 */
export const dynamic = "force-dynamic";

const erreur = (code: string, description: string, status = 400) =>
  NextResponse.json({ error: code, error_description: description }, { status, headers: { "Cache-Control": "no-store", ...ENTETES_CORS } });

async function lireCorps(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(j).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

export async function POST(req: Request) {
  const p = await lireCorps(req);
  try {
    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.client_id) return erreur("invalid_request", "code et client_id sont obligatoires.");
      const c = await consommerCode(p.code);
      if (!c || c.clientId !== p.client_id) return erreur("invalid_grant", "Code inconnu, expiré ou déjà utilisé.");
      if (p.redirect_uri && p.redirect_uri !== c.adresseRetour) return erreur("invalid_grant", "Adresse de retour différente de la demande.");
      if (!pkceValide(p.code_verifier, c.codeChallenge)) return erreur("invalid_grant", "Vérification PKCE échouée.");
      const paire = await emettreJetons(c.clientId, c.userId, c.scope);
      console.log(JSON.stringify({ tag: "getgents:oauth-mcp", event: "jetons_emis", clientId: c.clientId, userId: c.userId }));
      return NextResponse.json(paire, { headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...ENTETES_CORS } });
    }
    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token || !p.client_id) return erreur("invalid_request", "refresh_token et client_id sont obligatoires.");
      const paire = await renouveler(p.refresh_token, p.client_id);
      if (!paire) return erreur("invalid_grant", "Jeton de renouvellement invalide : reconnectez Getgents.");
      return NextResponse.json(paire, { headers: { "Cache-Control": "no-store", Pragma: "no-cache", ...ENTETES_CORS } });
    }
    return erreur("unsupported_grant_type", "authorization_code ou refresh_token.");
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:oauth-mcp", event: "jeton_echoue", detail: (e as Error).message }));
    return erreur("server_error", "Erreur du serveur.", 500);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: ENTETES_CORS });
}
