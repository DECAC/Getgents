import { NextResponse, type NextRequest } from "next/server";
import { chatResponseFor, type ChatBody } from "@/lib/server/chatEngine";
import { requireUserWithQuota } from "@/lib/server/gentGuard";

// Un tour avec boucle d'outils (MCP, datasets, API REST) peut être long.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // La garde vient EN PREMIER, avant même de regarder la configuration du
  // serveur : répondre « clé OpenRouter absente » à un inconnu lui apprend
  // déjà quelque chose sur l'installation. Cette route était ouverte à tous,
  // et n'importe qui pouvait y enchaîner des générations facturées.
  const garde = await requireUserWithQuota("llm");
  if (!garde.ok) return garde.response;

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Clé API OpenRouter absente. Créez un fichier .env.local à la racine du projet avec OPENROUTER_API_KEY=votre_clé, puis redémarrez le serveur (npm run dev).",
      },
      { status: 500 }
    );
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return chatResponseFor(body, key, req.headers.get("x-getgents-source") ?? "espace");
}
