import { NextResponse } from "next/server";
import { EXEMPLES, origineExemple } from "@/lib/exemplesPages";
import { PlafondAtteint } from "@/lib/offre";
import { requireUser } from "@/lib/server/session";
import { trouverOuCreerPage } from "@/lib/server/pages";
import { definirSuggestions } from "@/lib/server/suggestionsPages";

export const dynamic = "force-dynamic";

/**
 * Crée une PAGE D'EXEMPLE (`lib/exemplesPages.ts`) dans le compte : une page
 * ordinaire (supprimable, comptée dans le plafond), assistant ACTIVÉ et
 * questions suggérées posées — dont la question piège. Recliquer rouvre la
 * même page : un contenu identique retrouve la sienne (`trouverOuCreerPage`).
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { exemple?: unknown };
  const ex = EXEMPLES.find((e) => e.id === corps.exemple);
  if (!ex) return NextResponse.json({ error: "Exemple inconnu." }, { status: 400 });
  try {
    const { page, nouvelle } = await trouverOuCreerPage(auth.user.id, {
      titre: ex.titre,
      format: "html",
      contenu: ex.contenu,
      origine: origineExemple(ex.id),
      assistant: true,
    });
    if (nouvelle) {
      // Sans la migration 026, les bulles par défaut restent : l'exemple marche quand même.
      await definirSuggestions(
        auth.user.id,
        page.id,
        ex.suggestions.map((texte) => ({ texte, origine: "libre" as const }))
      ).catch((e) => console.error(JSON.stringify({ tag: "getgents:pages", event: "exemple_suggestions_echouees", detail: (e as Error).message })));
    }
    console.log(JSON.stringify({ tag: "getgents:pages", event: "exemple_cree", exemple: ex.id, nouvelle }));
    return NextResponse.json({ id: page.id, nouvelle });
  } catch (e) {
    if (e instanceof PlafondAtteint) return NextResponse.json({ error: e.message, plafond: e.genre }, { status: 409 });
    console.error(JSON.stringify({ tag: "getgents:pages", event: "exemple_echoue", detail: (e as Error).message }));
    return NextResponse.json({ error: "La page d'exemple n'a pas pu être créée. Réessayez." }, { status: 500 });
  }
}
