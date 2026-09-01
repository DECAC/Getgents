import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { estEmailPlausible, estSoiMeme, normalizeEmail } from "@/lib/emailIdentity";
import { envoyerInvitation } from "@/lib/server/invitations";

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

  // L'envoi ne conditionne pas le partage : l'accès est déjà accordé en base,
  // et le destinataire le verra à sa prochaine connexion même si l'e-mail
  // s'est perdu. Échouer ici ferait croire à un partage raté qui a bien eu lieu.
  const nomGent =
    (acces.value.row.espace as { name?: string } | null)?.name ?? "un gent";
  void envoyerInvitation(email, nomGent, role);

  return NextResponse.json({ grant: data });
}
