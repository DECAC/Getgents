import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { marquerReponsesVues, reponsesDeLaPage } from "@/lib/server/engagementPages";

/** Réponses des lecteurs au bouton d'engagement (auteur seulement). PATCH : les marquer vues. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const r = await reponsesDeLaPage(auth.user.id, id).catch(() => null);
  if (!r) return NextResponse.json({ error: "Les réponses n'ont pas pu être lues." }, { status: 500 });
  if (!r.ok) return r.raison === "introuvable" ? NextResponse.json({ error: "Page introuvable." }, { status: 404 }) : NextResponse.json({ reponses: [], migration: true });
  return NextResponse.json({ reponses: r.valeur }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  await marquerReponsesVues(auth.user.id, id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
