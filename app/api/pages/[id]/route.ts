import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { definirAssistantPage, detailPage, supprimerPage } from "@/lib/server/pages";
import { definirProtection, protectionActive, validations } from "@/lib/server/accesPartage";

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
  if (!page) return introuvable();
  // Protection par code (migration 023) : illisible = présentée comme coupée,
  // avec l'information pour que la fiche le dise.
  const protection = await protectionActive(page.id).catch(() => null);
  const valides = await validations(page.destinataires.map((d) => d.jeton)).catch(() => ({}));
  return NextResponse.json(
    { page: { ...page, protection: protection === true, protectionIllisible: protection === null, valides } },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Active ou coupe l'assistant, ou la protection par code, de la page (tous ses liens). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { assistant?: unknown; protection?: unknown };
  if (typeof corps.protection === "boolean") {
    const r = await definirProtection(auth.user.id, params.id, corps.protection).catch(() => "erreur" as const);
    if (r === "ok") {
      console.log(JSON.stringify({ tag: "getgents:acces", event: corps.protection ? "protection_activee" : "protection_coupee", ownerId: auth.user.id }));
      return NextResponse.json({ protection: corps.protection });
    }
    if (r === "introuvable") return introuvable();
    if (r === "migration_manquante")
      return NextResponse.json({ error: "La protection par code n'est pas encore installée (migration 023 à passer dans Supabase)." }, { status: 503 });
    return NextResponse.json({ error: "La protection n'a pas pu être modifiée. Réessayez." }, { status: 500 });
  }
  if (typeof corps.assistant !== "boolean") return NextResponse.json({ error: "assistant ou protection attendu (booléen)" }, { status: 400 });
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
