import { NextResponse } from "next/server";
import { compterChoix, reglageValide } from "@/lib/engagement";
import { lirePage } from "@/lib/server/pages";
import { requireUser } from "@/lib/server/session";
import { definirEngagement, lireEngagement } from "@/lib/server/engagementPages";

/** Bouton d'engagement d'une page : son réglage (auteur seulement). */
export const dynamic = "force-dynamic";

const MIGRATION = "Le bouton d'engagement n'est pas encore installé (migration 031 à passer dans Supabase).";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const r = await lireEngagement(auth.user.id, id).catch(() => null);
  if (!r) return NextResponse.json({ error: "Le réglage n'a pas pu être lu." }, { status: 500 });
  if (!r.ok) return r.raison === "introuvable" ? NextResponse.json({ error: "Page introuvable." }, { status: 404 }) : NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 });
  // Estimation lue dans le code : le bloc dit si la page offre des choix à joindre à la réponse.
  const page = await lirePage(auth.user.id, id).catch(() => null);
  return NextResponse.json({ engagement: r.valeur, choix: page ? compterChoix(page.contenu) : 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const reglage = reglageValide(await req.json().catch(() => null));
  if (!reglage) return NextResponse.json({ error: "Intitulé vide ou trop long (30 caractères au plus)." }, { status: 400 });
  const r = await definirEngagement(auth.user.id, id, reglage).catch(() => "erreur" as const);
  if (r === "introuvable") return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  if (r === "migration_manquante") return NextResponse.json({ error: MIGRATION, migration: true }, { status: 503 });
  if (r === "erreur") return NextResponse.json({ error: "Le réglage n'a pas pu être enregistré. Réessayez." }, { status: 500 });
  console.log(JSON.stringify({ tag: "getgents:engagement", event: reglage.actif ? "active" : "coupe", mot: reglage.mot }));
  return NextResponse.json({ engagement: reglage });
}
