import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/server/session";
import { createAuthClient, readOnlyBridge } from "@/lib/server/supabaseAuth";
import { LONGUEUR_MOT_DE_PASSE_MIN } from "@/lib/authMessages";

export const dynamic = "force-dynamic";

/**
 * Changement de mot de passe, avec RÉ-AUTHENTIFICATION préalable.
 *
 * `updateUser({ password })` de Supabase ne redemande pas le mot de passe
 * actuel : la session suffit. Posé tel quel sur une page permanente, cela
 * signifierait qu'une session volée — un poste laissé ouvert, un cookie
 * exfiltré — permet de s'emparer du compte pour de bon, en verrouillant son
 * propriétaire dehors.
 *
 * D'où le double appel qui suit, et qui paraîtrait absurde sans cette
 * explication : `signInWithPassword` prouve d'abord la connaissance du secret
 * courant, `updateUser` le remplace ensuite. Aucune route nouvelle, aucun
 * jeton à inventer.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { actuel?: unknown; nouveau?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const actuel = typeof body.actuel === "string" ? body.actuel : "";
  const nouveau = typeof body.nouveau === "string" ? body.nouveau : "";

  if (nouveau.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    return NextResponse.json(
      { error: `Le nouveau mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères.` },
      { status: 400 }
    );
  }
  if (nouveau === actuel) {
    return NextResponse.json({ error: "Le nouveau mot de passe est identique à l'ancien." }, { status: 400 });
  }
  if (!auth.user.confirmedEmail) {
    return NextResponse.json(
      { error: "Confirmez d'abord votre adresse e-mail." },
      { status: 400 }
    );
  }

  const client = createAuthClient(readOnlyBridge(() => cookies().getAll()));
  if (!client) return NextResponse.json({ error: "Authentification indisponible." }, { status: 503 });

  const { error: reauth } = await client.auth.signInWithPassword({
    email: auth.user.confirmedEmail,
    password: actuel,
  });
  if (reauth) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 403 });
  }

  const { error } = await client.auth.updateUser({ password: nouveau });
  if (error) {
    return NextResponse.json({ error: "Le changement de mot de passe a échoué." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
