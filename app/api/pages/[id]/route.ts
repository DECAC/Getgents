import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { definirAssistantPage, detailEtContenu, nombreDePages, supprimerPage } from "@/lib/server/pages";
import { definirProtection, protectionActive, validations } from "@/lib/server/accesPartage";
import { groupesDesLiens } from "@/lib/server/groupesPages";
import { definirLangue, reglageLangue } from "@/lib/server/langueLecteur";
import { langueDeclaree, langueDeLaPage, reglageValide } from "@/lib/langueLecteur";
import { supprimerFichiersPage } from "@/lib/server/fichiersPages";
import { supprimerCaptures } from "@/lib/server/apercusLien";

/**
 * Fiche d'une page. Toutes les opérations filtrent sur le PROPRIÉTAIRE
 * (session) : l'identifiant d'une page d'autrui ne donne rien — 404.
 */
export const dynamic = "force-dynamic";

const introuvable = () => NextResponse.json({ error: "Page introuvable." }, { status: 404 });

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const lu = await detailEtContenu(auth.user.id, params.id).catch(() => null);
  if (!lu) return introuvable();
  const { detail: page, contenu } = lu;
  const jetons = page.destinataires.map((d) => d.jeton);
  // Tout le reste EN PARALLÈLE : ces lectures se faisaient une à une, et la
  // fiche attendait leur somme avant de lancer ses autres blocs.
  const [protection, valides, groupes, premiere, reglage] = await Promise.all([
    // Protection par code (migration 023) : illisible = présentée comme coupée, avec l'information pour que la fiche le dise.
    protectionActive(page.id).catch(() => null),
    validations(jetons).catch(() => ({})),
    groupesDesLiens(jetons).catch(() => ({})),
    // Guide « Découvrez ce que vivra votre lecteur » : sur la PREMIÈRE page du compte.
    nombreDePages(auth.user.id).then((n) => n <= 1).catch(() => false),
    reglageLangue(page.id),
  ]);
  // Langue des lecteurs (lot anglais 1) : le réglage, et ce que la page dit d'elle-même.
  const langueLecteurs = {
    reglage,
    detectee: langueDeLaPage(contenu),
    declaree: langueDeclaree(contenu) !== null,
  };
  return NextResponse.json(
    {
      page: {
        ...page,
        protection: protection === true,
        protectionIllisible: protection === null,
        valides,
        groupes,
        premiere,
        moi: auth.user.confirmedEmail,
        langueLecteurs,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Active ou coupe l'assistant, la protection par code, ou règle la langue des lecteurs de la page (tous ses liens). */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const corps = (await req.json().catch(() => ({}))) as { assistant?: unknown; protection?: unknown; langueLecteurs?: unknown };
  if (corps.langueLecteurs !== undefined) {
    const reglage = reglageValide(corps.langueLecteurs);
    if (!reglage) return NextResponse.json({ error: "Langue attendue : auto, fr ou en." }, { status: 400 });
    const r = await definirLangue(auth.user.id, params.id, reglage).catch(() => "erreur" as const);
    if (r === "ok") return NextResponse.json({ langueLecteurs: reglage });
    if (r === "introuvable") return introuvable();
    if (r === "migration_manquante")
      return NextResponse.json({ error: "Le choix de langue n'est pas encore installé (migration 034 à passer dans Supabase)." }, { status: 503 });
    return NextResponse.json({ error: "La langue n'a pas pu être modifiée. Réessayez." }, { status: 500 });
  }
  if (typeof corps.protection === "boolean") {
    const r = await definirProtection(auth.user.id, params.id, corps.protection).catch(() => "erreur" as const);
    if (r === "ok") {
      console.log(JSON.stringify({ tag: "getgents:acces", event: corps.protection ? "protection_activee" : "protection_coupee", ownerId: auth.user.id }));
      return NextResponse.json({ protection: corps.protection });
    }
    if (r === "introuvable") return introuvable();
    if (r === "migration_manquante")
      return NextResponse.json({ error: "La protection par code n'est pas encore installée (migration 023 à passer dans Supabase)." }, { status: 503 });
    return NextResponse.json({ error: "La protection n'a pas pu être modifiée. Réessayez." }, { status: 500 });
  }
  if (typeof corps.assistant !== "boolean") return NextResponse.json({ error: "assistant ou protection attendu (booléen)" }, { status: 400 });
  const ok = await definirAssistantPage(auth.user.id, params.id, corps.assistant).catch(() => false);
  return ok ? NextResponse.json({ assistant: corps.assistant }) : introuvable();
}

/** Supprime la page : tous ses liens tombent. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const ok = await supprimerPage(auth.user.id, params.id).catch(() => false);
  if (ok) {
    console.log(JSON.stringify({ tag: "getgents:pages", event: "page_supprimee", ownerId: auth.user.id }));
    await supprimerFichiersPage(params.id).catch(() => undefined);
    await supprimerCaptures(params.id).catch(() => undefined);
  }
  return ok ? NextResponse.json({ supprimee: true }) : introuvable();
}
