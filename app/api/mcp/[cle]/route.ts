import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { traiterMessage, type DemandePartage, type Fidelite, type ReponseRpc } from "@/lib/mcpPartage";
import { enregistrerArtefact } from "@/lib/server/artefactsPartages";

/**
 * Connecteur MCP de partage d'artefacts — PHASE 0.
 *
 * Adresse à déclarer dans Claude ou ChatGPT : `/api/mcp/<MCP_ESSAI_CLE>`.
 * La clé dans l'adresse tient lieu d'authentification pour l'essai, et pour
 * l'essai seulement : quiconque la connaît peut publier. La phase 1 la
 * remplace par une vraie autorisation (OAuth) liée au compte du commercial.
 *
 * Transport « Streamable HTTP » en réponses JSON simples : chaque POST porte
 * un message JSON-RPC (ou un lot) et reçoit sa réponse dans le corps. Aucun
 * flux serveur (GET → 405), ce que la spécification autorise.
 */

export const dynamic = "force-dynamic";

function cleValide(cle: string): boolean {
  const attendue = process.env.MCP_ESSAI_CLE ?? "";
  // Une clé courte se devine : en dessous de 32 caractères, le connecteur reste fermé.
  if (attendue.length < 32) return false;
  const a = Buffer.from(cle);
  const b = Buffer.from(attendue);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** L'adresse publique qui a reçu l'appel : le lien pointe vers le même site (Vercel, Railway…). */
function origine(req: Request): string {
  const hote = req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${hote}`;
}

const introuvable = () => new NextResponse(null, { status: 404 });

export async function POST(req: Request, { params }: { params: { cle: string } }) {
  // Clé fausse ou connecteur non configuré : 404, sans rien révéler.
  if (!cleValide(params.cle)) return introuvable();

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }, { status: 400 });
  }

  const client = req.headers.get("user-agent");
  const base = origine(req);
  const ctx = {
    enregistrer: async (demande: DemandePartage, fidelite: Fidelite) => {
      const a = await enregistrerArtefact(demande, fidelite, client);
      console.log(
        JSON.stringify({
          tag: "getgents:partage",
          event: "artefact_partage",
          format: demande.format,
          caracteres: fidelite.caracteres,
          lignes: fidelite.lignes,
          finPresente: fidelite.finPresente,
          abreviationSuspecte: fidelite.abreviationSuspecte,
          client,
        })
      );
      return { lien: `${base}/partage/${a.jeton}` };
    },
  };

  const lot = Array.isArray(corps);
  const messages = lot ? (corps as unknown[]) : [corps];
  const reponses = (await Promise.all(messages.map((m) => traiterMessage(m, ctx)))).filter(
    (r): r is ReponseRpc => r !== null
  );

  // Que des notifications : rien à répondre.
  if (!reponses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(lot ? reponses : reponses[0], { headers: { "Cache-Control": "no-store" } });
}

export async function GET(_req: Request, { params }: { params: { cle: string } }) {
  if (!cleValide(params.cle)) return introuvable();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(_req: Request, { params }: { params: { cle: string } }) {
  if (!cleValide(params.cle)) return introuvable();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
