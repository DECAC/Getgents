import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/server/session";
import { createAuthClient, readOnlyBridge } from "@/lib/server/supabaseAuth";
import {
  MESSAGE_NOM_INVALIDE,
  nomAfficheValide,
  normaliserNomAffiche,
} from "@/lib/nomAffiche";

export const dynamic = "force-dynamic";

/** Nom affiché courant. Le studio s'en sert comme attribution par défaut. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ nom: auth.user.nomAffiche });
}

/**
 * Nom affiché du compte — celui qui apparaît sous « Proposé par » quand un
 * gent est publié et qu'aucun nom ne lui est propre.
 *
 * Il vit dans les métadonnées du compte plutôt que dans une table à nous :
 * c'est une propriété de l'identité, pas du métier, et la suppression du
 * compte l'emporte alors sans que `delete_account` ait à s'en occuper.
 *
 * Un nom vide EFFACE l'attribution — c'est un choix, pas une erreur : publier
 * sans dire qui l'on est doit rester possible.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  let body: { nom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const nom = normaliserNomAffiche(body.nom);
  if (nom && !nomAfficheValide(nom)) {
    return NextResponse.json({ error: MESSAGE_NOM_INVALIDE }, { status: 400 });
  }

  const client = createAuthClient(readOnlyBridge(() => cookies().getAll()));
  if (!client) return NextResponse.json({ error: "Authentification indisponible." }, { status: 503 });

  const { error } = await client.auth.updateUser({ data: { nom_affiche: nom } });
  if (error) {
    return NextResponse.json({ error: "L'enregistrement du nom a échoué." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, nom });
}
