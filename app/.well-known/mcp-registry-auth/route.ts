/**
 * Preuve de propriété du domaine pour le registre MCP officiel (connexion
 * « HTTP » de `mcp-publisher`). Le contenu est la ligne PUBLIQUE
 * `v=MCPv1; k=ed25519; p=<clé publique>` — la clé privée ne quitte jamais la
 * machine de l'éditeur. Lue dans `MCP_REGISTRE_PREUVE` (Vercel) : sans elle,
 * 404 — rien n'est annoncé.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const preuve = (process.env.MCP_REGISTRE_PREUVE ?? "").trim();
  if (!/^v=MCPv1; k=(ed25519|ecdsap384); p=[A-Za-z0-9+/=]+$/.test(preuve)) return new Response("Not found", { status: 404 });
  return new Response(`${preuve}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
