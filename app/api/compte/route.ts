import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/session";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

/**
 * Suppression du compte.
 *
 * Obligation légale à l'ouverture des inscriptions — et, plus prosaïquement,
 * un prototype incapable d'effacer accumule des comptes de test qu'on finit
 * par nettoyer à la main en base.
 *
 * L'ordre importe : le ménage explicite D'ABORD (`delete_account`), la
 * suppression du compte d'authentification ENSUITE. La cascade de la
 * migration 006 passe par `owner_id`, qui est nullable : les lignes
 * antérieures à la reprise ne seraient pas emportées, et des jetons OAuth
 * Gmail — les identifiants d'accès à la boîte mail de quelqu'un qui demande
 * son effacement — resteraient en base. Si la suppression du compte échoue
 * après le ménage, l'utilisateur retrouve un compte vide : gênant, mais rien
 * n'a fuité. L'ordre inverse laisserait les données sans propriétaire.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { confirmation?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  // La confirmation par saisie n'est pas un ornement : ce geste est
  // irréversible, et un bouton seul se clique par accident.
  const saisie = typeof body.confirmation === "string" ? body.confirmation.trim().toLowerCase() : "";
  if (!auth.user.confirmedEmail || saisie !== auth.user.confirmedEmail) {
    return NextResponse.json(
      { error: "Saisissez votre adresse e-mail exacte pour confirmer la suppression." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Base indisponible." }, { status: 503 });

  const { data, error } = await supabase.rpc("delete_account", { p_user: auth.user.id });
  if (error) {
    console.error(
      JSON.stringify({ tag: "getgents:compte", event: "delete_account_failed", detail: error.message })
    );
    return NextResponse.json({ error: "La suppression a échoué. Réessayez." }, { status: 500 });
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(auth.user.id);
  if (authError) {
    console.error(
      JSON.stringify({ tag: "getgents:compte", event: "delete_user_failed", detail: authError.message })
    );
    return NextResponse.json(
      { error: "Vos données ont été effacées, mais le compte n'a pas pu être supprimé. Contactez le support." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, gents: typeof data === "number" ? data : 0 });
}

/**
 * Décompte de ce qui disparaîtra. L'écran de suppression l'affiche avant la
 * confirmation : « vos 7 gents et leurs liens de diffusion » est une phrase
 * qu'on peut peser, « toutes vos données » n'en est pas une.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ gents: 0, brouillons: 0, liens: 0, partages: 0 });

  const compter = async (table: string, colonne: string) => {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(colonne, auth.user.id);
    return count ?? 0;
  };

  return NextResponse.json({
    gents: await compter("published_gents", "owner_id"),
    brouillons: await compter("gent_drafts", "owner_id"),
    liens: await compter("share_links", "owner_id"),
    partages: await compter("gent_grants", "invited_by"),
  });
}
