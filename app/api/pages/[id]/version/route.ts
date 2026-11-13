import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { contenuPourProprietaire, detailPage, estIdPage, mettreAJourPage } from "@/lib/server/pages";
import { alertesImport, nettoyerCollage, premiereDifference } from "@/lib/importPage";
import { FORMATS_ARTEFACT, statutPartage, TITRE_MAX, type FormatArtefact } from "@/lib/mcpPartage";

/**
 * Nouvelle version d'une page par COLLAGE. `simuler: true` ne publie rien :
 * il rend ce qui change et le nombre de liens concernés, pour la fenêtre de
 * confirmation. Même mécanique de versions que le connecteur : l'état
 * précédent est rangé, rien n'est détruit.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  if (!estIdPage(params.id)) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const actuelle = await contenuPourProprietaire(auth.user.id, params.id).catch(() => null);
  if (!actuelle) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  const contenu = nettoyerCollage(typeof corps.contenu === "string" ? corps.contenu : "");
  const format = (FORMATS_ARTEFACT as readonly string[]).includes(corps.format as string) ? (corps.format as FormatArtefact) : actuelle.format;
  const titre = (typeof corps.titre === "string" ? corps.titre : "").trim().slice(0, TITRE_MAX) || actuelle.titre;
  const alertes = alertesImport(contenu, format);
  const bloquante = alertes.find((a) => a.niveau === "bloquant");
  if (bloquante) return NextResponse.json({ error: bloquante.texte, alertes }, { status: 400 });
  const difference = premiereDifference(actuelle.contenu, contenu);
  const detail = await detailPage(auth.user.id, params.id);
  const liens = (detail?.destinataires ?? []).filter((d) => statutPartage(d) === "actif").length;
  const resume = {
    version: actuelle.version,
    suivante: actuelle.version + 1,
    titreAvant: actuelle.titre,
    titreApres: titre,
    caracteresAvant: actuelle.contenu.length,
    caracteresApres: contenu.length,
    difference,
    liens,
    alertes,
  };
  if (corps.simuler === true) return NextResponse.json(resume);
  if (difference.identique && titre === actuelle.titre && format === actuelle.format)
    return NextResponse.json({ error: "Ce code est identique à la version actuelle : rien à publier." }, { status: 409 });
  const page = await mettreAJourPage(auth.user.id, params.id, { contenu, titre, format });
  if (!page) return NextResponse.json({ error: "La version n'a pas pu être publiée. Réessayez." }, { status: 409 });
  console.log(JSON.stringify({ tag: "getgents:pages", event: "version_collee", version: page.version, liens }));
  return NextResponse.json({ ...resume, version: page.version });
}
