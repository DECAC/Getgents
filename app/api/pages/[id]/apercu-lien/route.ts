import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { protectionActive } from "@/lib/server/accesPartage";
import { capturerEtRanger, definirApercu, etatApercu } from "@/lib/server/apercusLien";

/**
 * Aperçu du lien par capture (option par page, onglet Page de la fiche).
 * GET : l'état ; POST : (re)faire la capture de la version courante ;
 * PATCH { actif } : activer (exige une capture à jour — l'auteur a vu
 * l'image) ou couper.
 */
export const dynamic = "force-dynamic";
// Lancer Chromium et attendre la page : jusqu'à ~20 s, plus le démarrage à froid.
export const maxDuration = 60;

const introuvable = () => NextResponse.json({ error: "Page introuvable." }, { status: 404 });
const MIGRATION = "L'aperçu par capture n'est pas encore installé (migration 039 à passer dans Supabase).";

async function etatComplet(ownerId: string, id: string) {
  const page = await lirePage(ownerId, id);
  if (!page) return null;
  const [etat, protegee] = await Promise.all([etatApercu(page.id), protectionActive(page.id).catch(() => true)]);
  return { actif: etat?.actif ?? false, version: etat?.version ?? null, captureLe: etat?.captureLe ?? null, versionPage: page.version, protegee };
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const e = await etatComplet(auth.user.id, id).catch(() => null);
  return e ? NextResponse.json(e, { headers: { "Cache-Control": "no-store" } }) : introuvable();
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const r = await capturerEtRanger(auth.user.id, id).catch((e: Error) => {
    console.error(JSON.stringify({ tag: "getgents:apercu-lien", event: "capture_exception", detail: e.message }));
    return { ok: false as const, raison: "erreur" as const };
  });
  if (!r.ok) {
    if (r.raison === "introuvable") return introuvable();
    if (r.raison === "migration_manquante") return NextResponse.json({ error: MIGRATION }, { status: 503 });
    if (r.raison === "protegee")
      return NextResponse.json({ error: "Cette page est protégée par code : son aperçu montrerait ce que le code protège." }, { status: 409 });
    const message =
      r.raison === "vide"
        ? "La page n'a rien affiché à temps (une page React peut dépendre d'un service extérieur). La vignette habituelle reste en place."
        : r.raison === "delai"
          ? "La capture a pris trop de temps. Réessayez dans un instant."
          : "La capture a échoué. Réessayez dans un instant.";
    return NextResponse.json({ error: message, raison: r.raison }, { status: 502 });
  }
  return NextResponse.json(await etatComplet(auth.user.id, id));
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { actif?: unknown };
  if (typeof corps.actif !== "boolean") return NextResponse.json({ error: "Réglage invalide." }, { status: 400 });
  const r = await definirApercu(auth.user.id, id, corps.actif).catch(() => "erreur" as const);
  if (r === "introuvable") return introuvable();
  if (r === "migration_manquante") return NextResponse.json({ error: MIGRATION }, { status: 503 });
  if (r === "protegee") return NextResponse.json({ error: "Impossible sur une page protégée par code." }, { status: 409 });
  if (r === "sans_capture") return NextResponse.json({ error: "Faites d'abord la capture de la version actuelle." }, { status: 409 });
  if (r === "erreur") return NextResponse.json({ error: "Le réglage n'a pas pu être enregistré. Réessayez." }, { status: 500 });
  return NextResponse.json(await etatComplet(auth.user.id, id));
}
