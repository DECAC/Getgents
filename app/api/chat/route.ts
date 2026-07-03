import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const upstream = await fetch(OPENROUTER_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://getgents.app",
      "X-Title": "Getgents",
    },
    body: JSON.stringify(body),
  });

  const isStream = (body as { stream?: boolean })?.stream === true;

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  if (isStream && upstream.body) {
    // Repasse le flux SSE d'OpenRouter tel quel — le client lit les tokens
    // au fur et à mesure pour un affichage progressif de la réponse.
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}
