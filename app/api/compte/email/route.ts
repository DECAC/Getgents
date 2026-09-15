import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/server/session";
import { createAuthClient, readOnlyBridge } from "@/lib/server/supabaseAuth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Demande de changement d'adresse.
 *
 * Supabase envoie une confirmation à la NOUVELLE adresse ; l'ancienne reste
 * active jusqu'au clic. On ne peut donc pas reporter les invitations reçues
 * (`gent_grants` visant l'ancienne adresse) au moment de la demande : elles
 * seraient déplacées vers une adresse dont rien ne prouve encore qu'elle
 * appartient au demandeur. Le report a lieu APRÈS confirmation, dans
 * `app/auth/callback` — et l'ancienne adresse est mémorisée ici, dans les
 * métadonnées du compte, seule façon de la retrouver ensuite.
 *
 * Sans ce report, les invitations déjà scellées (`grantee_id` rempli)
 * survivraient et les autres disparaîtraient : une moitié des partages en
 * attente s'évaporerait sans explication.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const nouvelle = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(nouvelle)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }
  if (nouvelle === auth.user.confirmedEmail) {
    return NextResponse.json({ error: "C'est déjà votre adresse." }, { status: 400 });
  }

  const client = createAuthClient(readOnlyBridge(() => cookies().getAll()));
  if (!client) return NextResponse.json({ error: "Authentification indisponible." }, { status: 503 });

  const { error } = await client.auth.updateUser({
    email: nouvelle,
    data: { email_precedent: auth.user.confirmedEmail },
  });

  if (error) {
    return NextResponse.json(
      { error: "Le changement d'adresse a échoué. Cette adresse est peut-être déjà utilisée." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, enAttente: nouvelle });
}
