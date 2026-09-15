import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireUser } from "@/lib/server/session";
import type { GentRole } from "@/lib/gentAccess";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Gents visibles par le compte connecté — les siens, plus ceux qu'on lui a
 * partagés nominativement.
 *
 * Cette route renvoyait AUPARAVANT toute la base : `select("id, espace")`
 * sans le moindre filtre, protégé par un secret d'instance unique et partagé.
 * Le filtre est ici applicatif et non délégué au RLS, parce que le serveur
 * écrit avec la clé `service_role`, qui le contourne.
 *
 * `roles` accompagne la liste pour que l'interface sache ce qu'elle peut
 * proposer : un gent reçu en lecture ne doit pas afficher de bouton Supprimer.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: possedes, error } = await supabase
    .from("published_gents")
    .select("id, espace")
    .eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gents: Record<string, unknown> = {};
  const roles: Record<string, GentRole> = {};
  for (const row of possedes ?? []) {
    gents[row.id] = row.espace;
    roles[row.id] = "owner";
  }

  // Invitations reçues : résolues par identifiant une fois scellées, et par
  // adresse CONFIRMÉE tant qu'elles ne le sont pas — sans quoi un invité ne
  // verrait rien avant son tout premier passage par le scellement.
  const critere = auth.user.confirmedEmail
    ? `grantee_id.eq.${auth.user.id},invited_email.eq.${auth.user.confirmedEmail}`
    : `grantee_id.eq.${auth.user.id}`;

  const { data: invitations } = await supabase
    .from("gent_grants")
    .select("gent_id, role")
    .is("revoked_at", null)
    .or(critere);

  const partages = (invitations ?? []).filter((g) => !(g.gent_id in gents));
  if (partages.length) {
    const { data: recus } = await supabase
      .from("published_gents")
      .select("id, espace")
      .in("id", partages.map((g) => g.gent_id));
    for (const row of recus ?? []) {
      const invitation = partages.find((g) => g.gent_id === row.id);
      const role = invitation?.role === "editor" ? "editor" : "viewer";
      roles[row.id] = role;
      // Un invité en LECTURE utilise le gent ; il n'en voit pas la cuisine.
      // Le prompt système est le travail du créateur, et la mémoire, les
      // conversations et les documents sont ses données personnelles. Seul le
      // co-éditeur, invité précisément pour construire avec lui, reçoit tout.
      gents[row.id] =
        role === "editor" ? row.espace : espaceForPublicLink(row.espace as Espace);
    }
  }

  return NextResponse.json({ gents, roles });
}
