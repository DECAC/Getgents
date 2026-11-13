import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { estIdPage } from "@/lib/server/pages";
import { modifierComplement, retirerComplement, validerComplement } from "@/lib/server/complementsPages";

/** Modifier ou retirer une précision de l'auteur. */
export const dynamic = "force-dynamic";

const idValide = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function PATCH(req: Request, { params }: { params: { id: string; cid: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id) || !idValide(params.cid)) return NextResponse.json({ error: "Précision introuvable." }, { status: 404 });
  const v = validerComplement(await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.erreur }, { status: 400 });
  return (await modifierComplement(auth.user.id, params.id, params.cid, v))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Précision introuvable." }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; cid: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id) || !idValide(params.cid)) return NextResponse.json({ error: "Précision introuvable." }, { status: 404 });
  return (await retirerComplement(auth.user.id, params.id, params.cid))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Précision introuvable." }, { status: 404 });
}
