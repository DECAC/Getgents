import { NextResponse, type NextRequest } from "next/server";
import { chatResponseFor, type ChatBody } from "@/lib/server/chatEngine";
import { consommerSiPlateforme } from "@/lib/server/gentGuard";
import { requireUser } from "@/lib/server/session";
import { contexteForUser } from "@/lib/server/openRouterKey";
import { messageCleOpenRouter } from "@/lib/openRouterKey";
import { MOTEUR_ELYSEE } from "@/lib/elysee2027/moteur";

// Un tour avec boucle d'outils (MCP, datasets, API REST) peut être long.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // LA GARDE VIENT EN PREMIER, avant même de lire le corps.
  //
  // Cette route était ouverte à tous, et n'importe qui pouvait y enchaîner des
  // générations facturées. Lire le corps avant d'authentifier rendait en outre
  // un 400 à un inconnu là où il devait recevoir un 401 : il apprenait que sa
  // requête avait été regardée, et un corps arbitraire était analysé sans
  // qu'aucun contrôle ne soit passé.
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Moteur de jeu déterministe (ex. « Élysée 2027 ») : aucune génération LLM,
  // donc AUCUN quota consommé et AUCUNE clé OpenRouter exigée — c'est tout
  // l'intérêt du jeu débranché. Le contexte de facturation est un leurre typé :
  // ce chemin n'appelle jamais OpenRouter.
  //
  // La condition porte sur l'identifiant EXACT du moteur, et non sur la
  // présence du champ : `jeu: "n-importe-quoi"` sauterait la garde de quota
  // puis retomberait sur le chemin LLM avec une clé vide — une porte de sortie
  // du compteur de facturation, exactement ce que la discipline interdit.
  if (body.jeu === MOTEUR_ELYSEE) {
    return chatResponseFor(body, { ownerId: auth.user.id, cle: "", source: "plateforme" }, "jeu");
  }

  // Quota et contexte de facturation résolus À LA MAIN plutôt que par
  // `requireUserWithQuota` : celui-ci ré-authentifie en interne, ce qui
  // coûterait un second aller-retour Supabase à CHAQUE tour de conversation —
  // sur le chemin dont la latence est le sujet permanent. Il reste en place
  // pour ses autres appelants.
  const ctx = await contexteForUser(auth.user.id);
  const quota = await consommerSiPlateforme(ctx, "llm");
  if (!quota.ok) return quota.response;

  // `ctx` dit qui paie ce tour : la clé personnelle du compte si elle est
  // enregistrée, la clé commune sinon. L'ancien message parlait de `.env.local`
  // et de `npm run dev` — il s'adressait au développeur, alors que la personne
  // qui le lit sur une plateforme ouverte n'a ni fichier ni terminal.
  if (!ctx.cle) {
    return NextResponse.json(
      { error: messageCleOpenRouter({ source: ctx.source, status: 0 }) },
      { status: 503 }
    );
  }

  return chatResponseFor(body, ctx, req.headers.get("x-getgents-source") ?? "espace");
}
