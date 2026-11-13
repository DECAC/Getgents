import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { estIdPage } from "@/lib/server/pages";
import { ajouterComplement, listerComplements, validerComplement } from "@/lib/server/complementsPages";
import { COMPLEMENTS_MAX } from "@/lib/assistantDocument";

/** Précisions de l'auteur sur une page : lues par l'assistant, pour tous les destinataires. */
export const dynamic = "force-dynamic";

const MIGRATION = "Les précisions ne sont pas encore en place (migration 025 à passer dans Supabase).";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const r = await listerComplements(auth.user.id, params.id);
  if (r.ok) return NextResponse.json({ complements: r.valeur });
  if (r.raison === "migration_manquante") return NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 });
  return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validerComplement(corps);
  if (!v.ok) return NextResponse.json({ error: v.erreur }, { status: 400 });
  const questionId = typeof corps.questionId === "string" && /^[0-9a-f-]{36}$/i.test(corps.questionId) ? corps.questionId : null;
  const r = await ajouterComplement(auth.user.id, params.id, { sujet: v.sujet, texte: v.texte, questionId });
  if (r.ok) {
    console.log(JSON.stringify({ tag: "getgents:activite", event: "complement_ajoute", depuisQuestion: !!questionId }));
    return NextResponse.json({ complement: r.valeur });
  }
  if (r.raison === "migration_manquante") return NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 });
  if (r.raison === "plafond") return NextResponse.json({ error: `${COMPLEMENTS_MAX} précisions au plus par page : intégrez-en dans la page elle-même.` }, { status: 409 });
  return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
}
