import { NextResponse } from "next/server";
import type { Espace } from "@/lib/types";
import {
  STARTER_PROMPT_INSTRUCTION,
  describeGentForStarters,
  parseStarters,
  STARTER_COUNT,
} from "@/lib/starterSignal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5";

/**
 * Génère les « déclencheurs » d'un gent conversationnel : cinq questions
 * d'amorce reflétant ses capacités réelles. Appelée une seule fois par gent
 * (le résultat est ensuite persisté dans l'espace) — pas de recherche web ni
 * d'outils ici, c'est une lecture de configuration, pas une vraie réponse.
 */
export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "openrouter_not_configured" }, { status: 503 });

  let body: { espace?: Espace };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const espace = body.espace;
  if (!espace || typeof espace !== "object") {
    return NextResponse.json({ error: "missing_espace" }, { status: 400 });
  }
  // Un gent en mode mini-application ne converse pas : rien à amorcer.
  if (espace.pinnedArtefact?.enabled) {
    return NextResponse.json({ starters: [] });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://getgents.app",
        "X-Title": "Getgents",
      },
      body: JSON.stringify({
        model: espace.chatModelId || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Tu conçois l'accueil d'un assistant conversationnel. À partir de la configuration " +
              "ci-dessous, tu proposes des questions d'amorce qui donnent à voir ce qu'il sait faire.\n\n" +
              describeGentForStarters(espace),
          },
          { role: "user", content: STARTER_PROMPT_INSTRUCTION },
        ],
        max_tokens: 700,
        // Le raisonnement consommerait le budget de tokens sans bénéfice ici :
        // la tâche est courte et entièrement contrainte par le format demandé.
        reasoning: { effort: "low" },
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: `network: ${(e as Error).message}` }, { status: 502 });
  }

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const err = data?.error;
    const message =
      typeof err === "string" ? err : typeof err?.message === "string" ? err.message : `status ${upstream.status}`;
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const data = await upstream.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const starters = parseStarters(content);
  if (starters.length < STARTER_COUNT) {
    // Mieux vaut ne rien afficher qu'un rang incomplet ou du texte parasite :
    // le client retombe simplement sur l'état vide d'origine.
    return NextResponse.json({ starters: starters.length ? starters : [] });
  }
  return NextResponse.json({ starters });
}
