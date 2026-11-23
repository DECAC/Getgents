import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { lirePage } from "@/lib/server/pages";
import { fichiersReferences, MESSAGE_FICHIER } from "@/lib/fichiersPage";
import { listerFichiers, MigrationFichiersManquante, preparerEnvoi, supprimerFichier } from "@/lib/server/fichiersPages";

export const dynamic = "force-dynamic";

/**
 * Fichiers joints d'une page, côté PROPRIÉTAIRE (filtré sur la session : 404
 * sinon). GET : fichiers joints et fichiers ATTENDUS (référencés par la page,
 * pas encore joints). POST : prépare un envoi (adresse signée). DELETE : retire.
 */
async function pageDuCompte(id: string) {
  const auth = await requireUser();
  if ("response" in auth) return { reponse: auth.response };
  const page = await lirePage(auth.user.id, id).catch(() => null);
  if (!page) return { reponse: NextResponse.json({ error: "Page introuvable." }, { status: 404 }) };
  return { page };
}

const migration = () =>
  NextResponse.json({ error: "Les fichiers joints ne sont pas encore installés (migration 036 à passer dans Supabase).", migration: true }, { status: 503 });

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  try {
    const fichiers = await listerFichiers(r.page.id);
    const joints = new Set(fichiers.map((f) => f.nom));
    const attendus = fichiersReferences(r.page.contenu).filter((n) => !joints.has(n));
    return NextResponse.json(
      { fichiers: fichiers.map(({ chemin: _c, ...f }) => f), attendus },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof MigrationFichiersManquante) return NextResponse.json({ fichiers: [], attendus: fichiersReferences(r.page.contenu), migration: true });
    return NextResponse.json({ error: "Les fichiers n'ont pas pu être lus." }, { status: 500 });
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  const c = (await req.json().catch(() => ({}))) as { nom?: unknown; type?: unknown; taille?: unknown };
  const demande = { nom: String(c.nom ?? "").trim(), type: String(c.type ?? ""), taille: Number(c.taille) };
  try {
    const p = await preparerEnvoi(r.page.id, demande);
    if (!p.ok) return NextResponse.json({ error: MESSAGE_FICHIER[p.refus] }, { status: 400 });
    return NextResponse.json(p.mode === "supabase" ? { url: p.url, chemin: p.chemin } : { local: true, chemin: p.chemin });
  } catch (e) {
    if (e instanceof MigrationFichiersManquante) return migration();
    return NextResponse.json({ error: "L'envoi n'a pas pu être préparé. Réessayez." }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const r = await pageDuCompte((await props.params).id);
  if (!r.page) return r.reponse;
  const nom = new URL(req.url).searchParams.get("nom") ?? "";
  const ok = await supprimerFichier(r.page.id, nom).catch(() => false);
  return ok ? NextResponse.json({ retire: true }) : NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
}
