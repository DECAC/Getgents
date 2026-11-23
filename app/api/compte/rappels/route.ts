import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { definirRappelsExpiration } from "@/lib/server/rappelsExpiration";

export const dynamic = "force-dynamic";

/** Active ou coupe les rappels d'expiration par e-mail du compte (Mon compte). */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let body: { actifs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }
  if (typeof body.actifs !== "boolean") return NextResponse.json({ error: "Réglage invalide." }, { status: 400 });
  const ok = await definirRappelsExpiration(auth.user.id, body.actifs);
  if (!ok) return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true, actifs: body.actifs });
}
