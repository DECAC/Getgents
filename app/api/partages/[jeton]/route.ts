import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { revoquerPartage } from "@/lib/server/artefactsPartages";

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
