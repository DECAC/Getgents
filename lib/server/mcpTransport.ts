import { NextResponse } from "next/server";
import { statutPartage, traiterMessage, type ContexteMcp, type DemandePartage, type Fidelite, type ReponseRpc } from "@/lib/mcpPartage";
import { enregistrerArtefact, lireArtefact, listerPartages, revoquerPartage, type Proprietaire } from "@/lib/server/artefactsPartages";
import { langueDuLecteur } from "@/lib/server/langueLecteur";
import { mettreAJourPage, trouverOuCreerPage } from "@/lib/server/pages";
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

/** Lit le corps JSON-RPC ; la réponse d'erreur si illisible. */
export async function lireCorpsMcp(req: Request): Promise<{ corps: unknown } | { reponse: NextResponse }> {
  try {
    return { corps: await req.json() };
  } catch {
    return { reponse: NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }, { status: 400, headers: ENTETES_CORS }) };
  }
}

/** Contexte sans propriétaire : tout appel d'outil qui y parviendrait échoue, rien n'est écrit. */
const sansProprietaire = (base: string): ContexteMcp => {
  const refuse = async (): Promise<never> => {
    throw new Error("connexion requise");
  };
  // Les quatre outils sont déclarés pour que `tools/list` les annonce TOUS (la liste dépend du contexte).
  return { base, enregistrer: refuse, lister: refuse, mettreAJour: refuse, revoquer: refuse };
};

/**
 * Réponse SANS jeton (initialize, tools/list, ping — `corpsPublic` l'a
 * vérifié). Aucun propriétaire : le contexte est vide, donc aucun outil ne
 * peut agir même si un `tools/call` arrivait jusqu'ici (il répond « outil
 * indisponible », jamais une écriture).
 */
export async function repondreSansJeton(corps: unknown, base: string, userAgent: string | null): Promise<NextResponse> {
  const lot = Array.isArray(corps);
  const messages = lot ? (corps as unknown[]) : [corps];
  const methodes = messages.map((m) => (m as { method?: string }).method).filter(Boolean);
  console.log(JSON.stringify({ tag: "getgents:mcp", event: "decouverte_sans_jeton", methodes, client: userAgent }));
  const reponses = (await Promise.all(messages.map((m) => traiterMessage(m, sansProprietaire(base))))).filter((r): r is ReponseRpc => r !== null);
  if (!reponses.length) return new NextResponse(null, { status: 202, headers: ENTETES_CORS });
  return NextResponse.json(lot ? reponses : reponses[0], { headers: { "Cache-Control": "no-store", ...ENTETES_CORS } });
}

export async function repondreMcp(req: Request, base: string, proprietaire: Proprietaire, corpsLu?: unknown): Promise<NextResponse> {
  let corps: unknown = corpsLu;
  if (corpsLu === undefined) {
    const lu = await lireCorpsMcp(req);
    if ("reponse" in lu) return lu.reponse;
    corps = lu.corps;
  }

  const client = req.headers.get("user-agent");
  const ctx: ContexteMcp = {
    creerPage: async (demande: DemandePartage) => {
      const plateforme = (await lireClient(proprietaire.clientId))?.nom ?? null;
      const { page, nouvelle } = await trouverOuCreerPage(proprietaire.userId, {
        titre: demande.titre,
        format: demande.format,
        contenu: demande.contenu,
        origine: plateforme,
        assistant: demande.assistant === true,
      });
      console.log(
        JSON.stringify({ tag: "getgents:partage", event: "page_sans_destinataire", nouvellePage: nouvelle, format: page.format, ownerId: proprietaire.userId, client })
      );
      return { pageId: page.id, nouvellePage: nouvelle, titre: page.titre };
    },
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
          // Le NOMBRE seulement : les coordonnées elles-mêmes ne vont pas au journal.
          coordonnees: fidelite ? fidelite.donnees.emails.length + fidelite.donnees.telephones.length : null,
          compte: "oauth",
          ownerId: proprietaire.userId,
          client,
        })
      );
      // Modèle de mail dans la langue des lecteurs de la page (lot anglais 1).
      const contenu = demande.contenu || ((await lireArtefact(a.jeton).catch(() => null))?.contenu ?? "");
      const langue = await langueDuLecteur({ pageId: a.pageId, contenu }, undefined).catch(() => "fr" as const);
      return { lien: `${base}/partage/${a.jeton}`, pageId: a.pageId ?? undefined, nouvellePage: a.nouvellePage, titre: a.titre, assistant: a.assistant, langue };
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
