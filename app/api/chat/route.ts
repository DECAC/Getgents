import { NextResponse, type NextRequest } from "next/server";
import { chatResponseFor, type ChatBody } from "@/lib/server/chatEngine";
import { requireUserWithQuota } from "@/lib/server/gentGuard";
import { messageCleOpenRouter } from "@/lib/openRouterKey";

// Un tour avec boucle d'outils (MCP, datasets, API REST) peut être long.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // La garde vient EN PREMIER, avant même de regarder la configuration du
  // serveur : répondre « clé OpenRouter absente » à un inconnu lui apprend
  // déjà quelque chose sur l'installation. Cette route était ouverte à tous,
  // et n'importe qui pouvait y enchaîner des générations facturées.
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

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return chatResponseFor(body, ctx, req.headers.get("x-getgents-source") ?? "espace");
}
