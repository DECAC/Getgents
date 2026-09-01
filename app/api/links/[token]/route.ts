import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { describeShareLinksFailure, getShareLink, revokeShareLink, TOKEN_RE } from "@/lib/server/shareLinks";

export const dynamic = "force-dynamic";

interface Params {
  params: { token: string };
}

/** Révocation d'un lien — immédiate et définitive. */
export async function DELETE(_req: Request, { params }: Params) {
  if (!TOKEN_RE.test(params.token)) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  // Révoquer le lien de quelqu'un d'autre couperait l'accès de ses
  // destinataires : on remonte donc au gent pour vérifier qui en dispose.
  const lien = await getShareLink(params.token).catch(() => null);
  if (!lien) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const acces = await requireGentAccess(lien.gentId, "admin");
  if (!acces.ok) return acces.response;

  try {
    await revokeShareLink(params.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
