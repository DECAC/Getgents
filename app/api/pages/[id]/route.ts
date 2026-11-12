import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { definirAssistantPage, detailPage, supprimerPage } from "@/lib/server/pages";

/**
 * Fiche d'une page. Toutes les opérations filtrent sur le PROPRIÉTAIRE
 * (session) : l'identifiant d'une page d'autrui ne donne rien — 404.
 */
export const dynamic = "force-dynamic";

const introuvable = () => NextResponse.json({ error: "Page introuvable." }, { status: 404 });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const page = await detailPage(auth.user.id, params.id).catch(() => null);
  return page ? NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } }) : introuvable();
}

/** Active ou coupe l'assistant de la page (tous ses liens). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { assistant?: unknown };
  if (typeof corps.assistant !== "boolean") return NextResponse.json({ error: "assistant attendu (booléen)" }, { status: 400 });
  const ok = await definirAssistantPage(auth.user.id, params.id, corps.assistant).catch(() => false);
  return ok ? NextResponse.json({ assistant: corps.assistant }) : introuvable();
}

/** Supprime la page : tous ses liens tombent. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const ok = await supprimerPage(auth.user.id, params.id).catch(() => false);
  if (ok) console.log(JSON.stringify({ tag: "getgents:pages", event: "page_supprimee", ownerId: auth.user.id }));
  return ok ? NextResponse.json({ supprimee: true }) : introuvable();
}
