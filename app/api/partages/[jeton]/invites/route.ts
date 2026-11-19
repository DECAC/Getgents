import { NextResponse } from "next/server";
import { invitesValides } from "@/lib/groupesPages";
import { requireUser } from "@/lib/server/session";
import { definirGroupe } from "@/lib/server/groupesPages";

/**
 * Modifie la liste des invités d'un lien de groupe (auteur seulement — la
 * garde de propriété est dans `definirGroupe`). Retirer un invité qui a déjà
 * répondu ne supprime PAS sa réponse.
 */
export const dynamic = "force-dynamic";

export async function PUT(req: Request, props: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const invites = invitesValides(((await req.json().catch(() => ({}))) as { invites?: unknown }).invites);
  if (invites.length === 0) return NextResponse.json({ error: "Gardez au moins un invité." }, { status: 400 });
  const r = await definirGroupe(auth.user.id, jeton, invites).catch(() => "erreur" as const);
  if (r === "introuvable") return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  if (r === "migration_manquante") return NextResponse.json({ error: "Les liens de groupe ne sont pas encore installés (migration 033)." }, { status: 503 });
  if (r === "erreur") return NextResponse.json({ error: "La liste n'a pas pu être enregistrée. Réessayez." }, { status: 500 });
  return NextResponse.json({ invites });
}
