import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { listerPages, trouverOuCreerPage } from "@/lib/server/pages";
import { alertesImport, nettoyerCollage, ORIGINE_COLLAGE } from "@/lib/importPage";
import { FORMATS_ARTEFACT, TITRE_MAX, type FormatArtefact } from "@/lib/mcpPartage";

/** Rubrique « Pages » : les pages du compte, sans leur contenu. */
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ pages: await listerPages(auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:pages", event: "liste_echouee", detail: (e as Error).message }));
    return NextResponse.json({ error: "Les pages n'ont pas pu être chargées." }, { status: 500 });
  }
}

/**
 * Créer une page en COLLANT le code d'un artefact (Claude, ChatGPT, Mistral…),
 * sans le connecteur. Même page que par le connecteur : un contenu déjà
 * connu retrouve sa page au lieu d'en créer une seconde.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const contenu = nettoyerCollage(typeof corps.contenu === "string" ? corps.contenu : "");
  const format = (FORMATS_ARTEFACT as readonly string[]).includes(corps.format as string) ? (corps.format as FormatArtefact) : null;
  const titre = (typeof corps.titre === "string" ? corps.titre : "").trim().slice(0, TITRE_MAX);
  if (!format) return NextResponse.json({ error: "Choisissez le format de la page." }, { status: 400 });
  if (!titre) return NextResponse.json({ error: "Donnez un titre à la page." }, { status: 400 });
  // Revérifié ici : le navigateur peut avoir été contourné.
  const bloquante = alertesImport(contenu, format).find((a) => a.niveau === "bloquant");
  if (bloquante) return NextResponse.json({ error: bloquante.texte }, { status: 400 });
  try {
    const { page, nouvelle } = await trouverOuCreerPage(auth.user.id, { titre, format, contenu, origine: ORIGINE_COLLAGE, assistant: false });
    console.log(JSON.stringify({ tag: "getgents:pages", event: "page_collee", nouvelle, format, caracteres: contenu.length }));
    return NextResponse.json({ id: page.id, nouvelle });
  } catch (e) {
    console.error(JSON.stringify({ tag: "getgents:pages", event: "collage_echoue", detail: (e as Error).message }));
    return NextResponse.json({ error: "La page n'a pas pu être créée. Réessayez." }, { status: 500 });
  }
}
