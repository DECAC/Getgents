import { NextResponse } from "next/server";
import { statutPartage, traiterMessage, type ContexteMcp, type DemandePartage, type Fidelite, type ReponseRpc } from "@/lib/mcpPartage";
import { enregistrerArtefact, listerPartages, revoquerPartage, type Proprietaire } from "@/lib/server/artefactsPartages";
import { mettreAJourPage } from "@/lib/server/pages";
import { lireClient } from "@/lib/server/oauthMcp";

/**
 * Transport MCP « Streamable HTTP » en réponses JSON simples, commun à la
 * route OAuth (/api/mcp) : chaque POST
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

export async function repondreMcp(req: Request, base: string, proprietaire: Proprietaire): Promise<NextResponse> {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }, { status: 400, headers: ENTETES_CORS });
  }

  const client = req.headers.get("user-agent");
  const ctx: ContexteMcp = {
    enregistrer: async (demande: DemandePartage, fidelite: Fidelite | null) => {
      // La plateforme d'origine d'une NOUVELLE page : le nom déclaré par le client MCP (« Claude »…).
      const plateforme = demande.pageId ? null : ((await lireClient(proprietaire.clientId))?.nom ?? null);
      const a = await enregistrerArtefact(demande, fidelite, client, proprietaire, plateforme);
      if (!a) return null;
      console.log(
        JSON.stringify({
          tag: "getgents:partage",
          event: "artefact_partage",
          format: a.format,
          repartage: !!demande.pageId,
          nouvellePage: a.nouvellePage,
          caracteres: fidelite?.caracteres ?? null,
          lignes: fidelite?.lignes ?? null,
          finPresente: fidelite?.finPresente ?? null,
          abreviationSuspecte: fidelite?.abreviationSuspecte ?? null,
          dependClaude: fidelite?.dependClaude ?? null,
          compte: "oauth",
          ownerId: proprietaire.userId,
          client,
        })
      );
      return { lien: `${base}/partage/${a.jeton}`, pageId: a.pageId ?? undefined, nouvellePage: a.nouvellePage, titre: a.titre, assistant: a.assistant };
    },
    mettreAJour: async (pageId, d) => {
      const page = await mettreAJourPage(proprietaire.userId, pageId, d);
      if (!page) return null;
      const liens = (await listerPartages(proprietaire.userId)).filter((p) => p.pageId === page.id && statutPartage(p) === "actif").length;
      console.log(JSON.stringify({ tag: "getgents:partage", event: "page_mise_a_jour", ownerId: proprietaire.userId, version: page.version, liens }));
      return { version: page.version, liens, format: page.format };
    },
    lister: () => listerPartages(proprietaire.userId),
    revoquer: (jeton: string) => revoquerPartage(proprietaire.userId, jeton),
    base: base,
  };

  const lot = Array.isArray(corps);
  const messages = lot ? (corps as unknown[]) : [corps];
  const reponses = (await Promise.all(messages.map((m) => traiterMessage(m, ctx)))).filter((r): r is ReponseRpc => r !== null);

  // Que des notifications : rien à répondre.
  if (!reponses.length) return new NextResponse(null, { status: 202, headers: ENTETES_CORS });
  return NextResponse.json(lot ? reponses : reponses[0], { headers: { "Cache-Control": "no-store", ...ENTETES_CORS } });
}
