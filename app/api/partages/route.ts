import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { listerPartages } from "@/lib/server/artefactsPartages";
import { statutPartage } from "@/lib/mcpPartage";

/** « Mes partages » (page Compte) : les artefacts partagés par CE compte, sans leur contenu. */
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    const partages = (await listerPartages(auth.user.id)).map((p) => ({ ...p, statut: statutPartage(p) }));
    return NextResponse.json({ partages }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "lecture_impossible" }, { status: 500 });
  }
}
