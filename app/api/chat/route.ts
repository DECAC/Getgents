import { NextResponse, type NextRequest } from "next/server";
import { chatResponseFor, type ChatBody } from "@/lib/server/chatEngine";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { requireUser } from "@/lib/server/session";
import { messageCleOpenRouter } from "@/lib/openRouterKey";
import { MOTEUR_ELYSEE } from "@/lib/elysee2027/moteur";

// Un tour avec boucle d'outils (MCP, datasets, API REST) peut être long.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Le corps est lu d'abord pour distinguer les appels « moteur de jeu » :
  // invalide → 400, ce qui n'apprend rien à personne sur l'installation.
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Moteur de jeu déterministe (ex. « Élysée 2027 ») : aucune génération LLM,
  // donc AUCUN quota consommé et AUCUNE clé OpenRouter exigée — c'est tout
  // l'intérêt du jeu débranché. La session reste obligatoire. Le contexte
  // facturation est un leurre typé : ce chemin n'appelle jamais OpenRouter.
  //
  // La condition porte sur l'identifiant EXACT du moteur, et non sur la
  // présence du champ : `jeu: "n-importe-quoi"` sautait la garde de quota
  // puis retombait sur le chemin LLM avec une clé vide — une porte de sortie
  // du compteur de facturation, exactement ce que la discipline interdit.
  if (body.jeu === MOTEUR_ELYSEE) {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    return chatResponseFor(body, { ownerId: auth.user.id, cle: "", source: "plateforme" }, "jeu");
  }

  // La garde vient avant même de regarder la configuration du serveur :
  // répondre « clé OpenRouter absente » à un inconnu lui apprend déjà quelque
  // chose sur l'installation. Cette route était ouverte à tous, et n'importe
  // qui pouvait y enchaîner des générations facturées.
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;

  // `ctx` dit qui paie ce tour : la clé personnelle du compte si elle est
  // enregistrée, la clé commune sinon. L'ancien message parlait de `.env.local`
  // et de `npm run dev` — il s'adressait au développeur, alors que la personne
  // qui le lit sur une plateforme ouverte n'a ni fichier ni terminal.
  const { ctx } = garde.value;
  if (!ctx.cle) {
    return NextResponse.json(
      { error: messageCleOpenRouter({ source: ctx.source, status: 0 }) },
      { status: 503 }
    );
  }

  return chatResponseFor(body, ctx, req.headers.get("x-getgents-source") ?? "espace");
}
