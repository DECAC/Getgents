import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { MESSAGE_FICHIER } from "@/lib/fichiersPage";
import { confirmerEnvoi, MigrationFichiersManquante } from "@/lib/server/fichiersPages";

export const dynamic = "force-dynamic";

/** Second temps de l'envoi : le fichier est dans Storage, on le relit et on l'enregistre. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const page = await lirePage(auth.user.id, params.id).catch(() => null);
  if (!page) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const c = (await req.json().catch(() => ({}))) as { nom?: unknown; chemin?: unknown };
  try {
    const r = await confirmerEnvoi(page.id, { nom: String(c.nom ?? "").trim(), chemin: String(c.chemin ?? "") });
    if (!r.ok)
      return NextResponse.json({ error: r.refus === "absent" ? "Le fichier n'est pas arrivé. Réessayez." : MESSAGE_FICHIER[r.refus] }, { status: 400 });
    const { chemin: _c, ...fichier } = r.fichier;
    return NextResponse.json({ fichier });
  } catch (e) {
    if (e instanceof MigrationFichiersManquante)
      return NextResponse.json({ error: "Les fichiers joints ne sont pas encore installés (migration 036).", migration: true }, { status: 503 });
    return NextResponse.json({ error: "Le fichier n'a pas pu être enregistré. Réessayez." }, { status: 500 });
  }
}
