import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { listerPages } from "@/lib/server/pages";

/** Rubrique « Pages » : les pages du compte, sans leur contenu. */
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ pages: await listerPages(auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:pages", event: "liste_echouee", detail: (e as Error).message }));
    return NextResponse.json({ error: "Les pages n'ont pas pu être chargées." }, { status: 500 });
  }
}
