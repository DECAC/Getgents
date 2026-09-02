import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { estEmailPlausible, estSoiMeme, normalizeEmail } from "@/lib/emailIdentity";
import { envoyerInvitation } from "@/lib/server/invitations";
import { createShareLink, lienInvitePour } from "@/lib/server/shareLinks";
import { appUrl } from "@/lib/server/invitations";
import { shareLinkUrl } from "@/lib/shareLink";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

/** Avec qui ce gent est-il partagé ? */
export async function GET(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("gent_grants")
    .select("id, invited_email, role, created_at, accepted_at")
    .eq("gent_id", params.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grants: data ?? [] });
}

/** Inviter une personne, par son adresse. */
export async function POST(req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  // Partager, c'est disposer du gent : réservé au propriétaire. Un co-éditeur
  // travaille dessus, il n'élargit pas le cercle.
  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!estEmailPlausible(email)) {
    return NextResponse.json({ error: "Cette adresse e-mail n'est pas valide." }, { status: 400 });
  }
  if (estSoiMeme(email, acces.value.user.confirmedEmail)) {
    return NextResponse.json({ error: "Ce gent est déjà le vôtre." }, { status: 400 });
  }
  const role = body.role === "editor" ? "editor" : "viewer";

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  // `upsert` sur (gent_id, invited_email) : ré-inviter quelqu'un met à jour
  // son rôle et réactive une invitation révoquée, au lieu d'en empiler une
  // seconde qui laisserait deux droits contradictoires en vigueur.
  const { data, error } = await supabase
    .from("gent_grants")
    .upsert(
      {
        gent_id: params.id,
        invited_email: email,
        role,
        invited_by: acces.value.user.id,
        revoked_at: null,
      },
      { onConflict: "gent_id,invited_email" }
    )
    .select("id, invited_email, role, created_at, accepted_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /*
   * Un LECTEUR reçoit un lien invité : il n'a pas de compte à créer.
   *
   * C'est la conséquence directe de l'accès restreint. Sans cela, l'invitation
   * mènerait à un écran qui explique qu'on ne peut pas s'inscrire, et le
   * partage tomberait dans le vide — ce qu'il faisait depuis la fermeture.
   *
   * Le lien est réutilisé s'il existe déjà : repartager deux fois au même
   * destinataire ne doit pas laisser deux liens vivants, dont un que le
   * propriétaire aurait oublié en révoquant.
   *
   * La ligne `gent_grants` est conservée dans les deux cas : c'est elle qui
   * tient la liste « avec qui ai-je partagé », qui porte la révocation, et qui
   * fera apparaître le gent dans l'espace de l'invité s'il ouvre un compte
   * plus tard avec cette adresse.
   */
  let lien: string | null = null;
  if (role === "viewer") {
    try {
      const existant = await lienInvitePour(params.id, email);
      const cible =
        existant ??
        (await createShareLink({
          gentId: params.id,
          ownerId: acces.value.user.id,
          targetLabel: email,
          // La conversation est le sens même d'un gent : un invité qui ne peut
          // que regarder n'a rien reçu. Chaque tour est facturé au
          // propriétaire et décompté sur son quota — c'est déjà le cas pour
          // tous les liens de partage.
          allowChat: true,
        }));
      lien = shareLinkUrl(appUrl(), cible.token);
    } catch (e) {
      // Un lien qu'on n'a pas pu créer ne doit pas annuler le partage : l'accès
      // en base existe, et le propriétaire peut renvoyer l'invitation. Mais il
      // doit être visible, sinon on croit l'invité servi alors qu'il n'a rien.
      console.error(
        JSON.stringify({
          tag: "getgents:partage",
          event: "lien_invite_echoue",
          gent: params.id,
          detail: (e as Error).message,
        })
      );
    }
  }

  // L'envoi ne conditionne pas le partage : l'accès est déjà accordé en base,
  // et le destinataire le verra à sa prochaine connexion même si l'e-mail
  // s'est perdu. Échouer ici ferait croire à un partage raté qui a bien eu lieu.
  const nomGent =
    (acces.value.row.espace as { name?: string } | null)?.name ?? "un gent";
  void envoyerInvitation(email, nomGent, role, lien);

  return NextResponse.json({ grant: data, lien });
}
