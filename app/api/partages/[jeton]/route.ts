import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { definirAssistant, revoquerPartage } from "@/lib/server/artefactsPartages";

/**
 * Révocation d'un partage depuis la page Compte. La garde est double :
 * session (requireUser) ET propriété (`revoquerPartage` filtre sur
 * `owner_id`) — le jeton d'autrui ne suffit pas.
 */
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { jeton: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    const coupe = await revoquerPartage(auth.user.id, params.jeton);
    return coupe ? NextResponse.json({ revoque: true }) : NextResponse.json({ error: "introuvable" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "revocation_impossible" }, { status: 500 });
  }
}

/** Active ou coupe l'assistant du document — même double garde. */
export async function PATCH(req: Request, { params }: { params: { jeton: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { assistant?: unknown };
  if (typeof corps.assistant !== "boolean") return NextResponse.json({ error: "assistant attendu (booléen)" }, { status: 400 });
  try {
    const ok = await definirAssistant(auth.user.id, params.jeton, corps.assistant);
    return ok ? NextResponse.json({ assistant: corps.assistant }) : NextResponse.json({ error: "introuvable" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "modification_impossible" }, { status: 500 });
  }
}
