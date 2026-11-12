import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { restaurerVersion } from "@/lib/server/pages";

/** Remet une ancienne version en tête — comme une NOUVELLE version : rien n'est détruit. */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { version?: unknown };
  if (typeof corps.version !== "number") return NextResponse.json({ error: "version attendue" }, { status: 400 });
  try {
    const page = await restaurerVersion(auth.user.id, params.id, corps.version);
    if (!page) return NextResponse.json({ error: "Version introuvable." }, { status: 404 });
    return NextResponse.json({ version: page.version });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message === "mise_a_jour_concurrente" ? "La page vient de changer : rechargez." : "La restauration a échoué." }, { status: 409 });
  }
}
