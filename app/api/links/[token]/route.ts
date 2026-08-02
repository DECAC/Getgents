import { NextResponse } from "next/server";
import { checkAppAccess, APP_ACCESS_HINT } from "@/lib/server/appAccess";
import { describeShareLinksFailure, revokeShareLink, TOKEN_RE } from "@/lib/server/shareLinks";

export const dynamic = "force-dynamic";

interface Params {
  params: { token: string };
}

/** Révocation d'un lien — immédiate et définitive. */
export async function DELETE(req: Request, { params }: Params) {
  if (!checkAppAccess(req)) return NextResponse.json({ error: "unauthorized", hint: APP_ACCESS_HINT }, { status: 401 });
  if (!TOKEN_RE.test(params.token)) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  try {
    await revokeShareLink(params.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, hint, status } = describeShareLinksFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
