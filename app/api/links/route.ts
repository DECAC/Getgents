import { NextResponse } from "next/server";
import { checkAppAccess } from "@/lib/server/appAccess";
import { createShareLink, listShareLinks, statsForTokens } from "@/lib/server/shareLinks";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

function fail(e: unknown) {
  const msg = (e as Error).message;
  return NextResponse.json(
    {
      error: msg,
      hint:
        msg === "supabase_not_configured"
          ? "Les liens de partage exigent Supabase : le destinataire n'a pas le cache local du créateur. Configurez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, puis exécutez supabase/migrations/002_share_links.sql."
          : undefined,
    },
    { status: msg === "supabase_not_configured" ? 503 : 500 }
  );
}

/** Liste les liens d'un gent, avec leurs agrégats de tracking. */
export async function GET(req: Request) {
  if (!checkAppAccess(req)) return unauthorized();
  const gentId = new URL(req.url).searchParams.get("gentId");
  if (!gentId || !ID_RE.test(gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  try {
    const links = await listShareLinks(gentId);
    const stats = await statsForTokens(links.map((l) => l.token));
    return NextResponse.json({ links, stats });
  } catch (e) {
    return fail(e);
  }
}

/** Crée un lien personnalisé vers une cible. */
export async function POST(req: Request) {
  if (!checkAppAccess(req)) return unauthorized();

  let body: {
    gentId?: string;
    targetLabel?: string;
    expiresAt?: string | null;
    allowChat?: boolean;
    allowRefresh?: boolean;
    maxRefresh?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const gentId = body.gentId;
  const targetLabel = (body.targetLabel ?? "").trim();
  if (!gentId || !ID_RE.test(gentId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!targetLabel) return NextResponse.json({ error: "missing_target" }, { status: 400 });

  try {
    const link = await createShareLink({
      gentId,
      targetLabel: targetLabel.slice(0, 160),
      expiresAt: body.expiresAt ?? null,
      allowChat: body.allowChat,
      allowRefresh: body.allowRefresh,
      maxRefresh: typeof body.maxRefresh === "number" ? Math.max(0, Math.min(500, body.maxRefresh)) : undefined,
    });
    return NextResponse.json({ link });
  } catch (e) {
    return fail(e);
  }
}
