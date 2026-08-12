import { NextResponse } from "next/server";
import { resolveRouting, routingPrompt, SUPER_GENT_ROUTER_MODEL, type GentDescriptor } from "@/lib/superGent";

const OPENROUTER_API = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Routeur du « super gent » : reçoit la question et la liste des gents actifs,
 * renvoie l'identifiant de celui qui doit répondre (ou null).
 *
 * Ne produit AUCUNE réponse : le client enchaîne ensuite sur /api/chat avec
 * l'espace du gent désigné, pour que celui-ci réponde avec son runtime complet
 * (connecteurs, recherche web, base de connaissance).
 */
export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "openrouter_not_configured" }, { status: 503 });

  let body: { question?: string; gents?: GentDescriptor[]; currentGentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const gents = Array.isArray(body.gents) ? body.gents : [];
  if (!question) return NextResponse.json({ error: "missing_question" }, { status: 400 });
  if (!gents.length) return NextResponse.json({ gentId: null, reason: "aucun gent actif" });
  // Un seul gent routable : le classement n'apporte rien, on économise l'appel.
  if (gents.length === 1) return NextResponse.json({ gentId: gents[0].id });

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
        model: SUPER_GENT_ROUTER_MODEL,
        messages: [
          { role: "system", content: routingPrompt(gents, body.currentGentId) },
          { role: "user", content: question },
        ],
        max_tokens: 120,
        temperature: 0,
      }),
    });
  } catch {
    // Réseau indisponible : on garde le gent en cours plutôt que d'échouer.
    return NextResponse.json({ gentId: body.currentGentId ?? null, reason: "routage indisponible" });
  }

  if (!upstream.ok) {
    return NextResponse.json({ gentId: body.currentGentId ?? null, reason: "routage indisponible" });
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  return NextResponse.json(resolveRouting(raw, gents, body.currentGentId));
}
