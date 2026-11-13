import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { activitePage } from "@/lib/server/activitePages";
import { estIdPage } from "@/lib/server/pages";

/** L'onglet Activité d'une page : lectures partagées et questions anonymes. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const r = await activitePage(auth.user.id, params.id);
  if (r.ok) return NextResponse.json(r.activite);
  if (r.raison === "introuvable") return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  return NextResponse.json({ error: "La mesure de l'activité n'est pas encore en place (migration 024 à passer dans Supabase).", migration: true }, { status: 503 });
}
