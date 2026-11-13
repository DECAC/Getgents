import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { estIdPage, lirePage } from "@/lib/server/pages";
import { definirSuggestions, lireSuggestions } from "@/lib/server/suggestionsPages";
import { SUGGESTIONS_MAX, suggestionsParDefaut, suggestionsValides } from "@/lib/suggestionsPage";
import { amorcesAssistant } from "@/lib/assistantDocument";

/** Questions suggérées aux visiteurs dans l'assistant : choisies et relues par l'auteur. */
export const dynamic = "force-dynamic";

const MIGRATION = "Les questions suggérées ne sont pas encore en place (migration 026 à passer dans Supabase).";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const r = await lireSuggestions(auth.user.id, params.id);
  if (!r.ok)
    return r.raison === "migration_manquante"
      ? NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 })
      : NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const page = await lirePage(auth.user.id, params.id);
  return NextResponse.json({ suggestions: r.suggestions ?? suggestionsParDefaut(amorcesAssistant(page!.format)), parDefaut: r.suggestions === null });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const suggestions = suggestionsValides(await req.json().catch(() => null));
  if (!suggestions) return NextResponse.json({ error: `Liste invalide : ${SUGGESTIONS_MAX} questions au plus, 200 caractères chacune.` }, { status: 400 });
  const r = await definirSuggestions(auth.user.id, params.id, suggestions);
  if (r === "migration_manquante") return NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 });
  if (r === "introuvable") return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  console.log(JSON.stringify({ tag: "getgents:activite", event: "suggestions_definies", nombre: suggestions.length, depuisQuestions: suggestions.filter((s) => s.origine === "question").length }));
  return NextResponse.json({ suggestions });
}
