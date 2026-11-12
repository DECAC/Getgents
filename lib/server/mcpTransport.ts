import { NextResponse } from "next/server";
import { traiterMessage, type DemandePartage, type Fidelite, type ReponseRpc } from "@/lib/mcpPartage";
import { enregistrerArtefact, type Proprietaire } from "@/lib/server/artefactsPartages";

/**
 * Transport MCP « Streamable HTTP » en réponses JSON simples, commun à la
 * route OAuth (/api/mcp) et à la route d'essai (/api/mcp/<clé>) : chaque POST
 * porte un message JSON-RPC (ou un lot) et reçoit sa réponse dans le corps.
 * Aucun flux serveur (GET → 405), ce que la spécification autorise.
 */

export const ENTETES_CORS = {
  // Jeton porteur dans l'en-tête, aucun cookie : ouvrir à toute origine ne
  // donne rien de plus qu'un appel serveur (l'inspecteur MCP tourne dans un navigateur).
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export async function repondreMcp(req: Request, origine: string, proprietaire: Proprietaire | null): Promise<NextResponse> {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }, { status: 400, headers: ENTETES_CORS });
  }

  const client = req.headers.get("user-agent");
  const ctx = {
    enregistrer: async (demande: DemandePartage, fidelite: Fidelite) => {
      const a = await enregistrerArtefact(demande, fidelite, client, proprietaire);
      console.log(
        JSON.stringify({
          tag: "getgents:partage",
          event: "artefact_partage",
          format: demande.format,
          caracteres: fidelite.caracteres,
          lignes: fidelite.lignes,
          finPresente: fidelite.finPresente,
          abreviationSuspecte: fidelite.abreviationSuspecte,
          dependClaude: fidelite.dependClaude,
          compte: proprietaire ? "oauth" : "cle_essai",
          ownerId: proprietaire?.userId ?? null,
          client,
        })
      );
      return { lien: `${origine}/partage/${a.jeton}` };
    },
  };

  const lot = Array.isArray(corps);
  const messages = lot ? (corps as unknown[]) : [corps];
  const reponses = (await Promise.all(messages.map((m) => traiterMessage(m, ctx)))).filter((r): r is ReponseRpc => r !== null);

  // Que des notifications : rien à répondre.
  if (!reponses.length) return new NextResponse(null, { status: 202, headers: ENTETES_CORS });
  return NextResponse.json(lot ? reponses : reponses[0], { headers: { "Cache-Control": "no-store", ...ENTETES_CORS } });
}
