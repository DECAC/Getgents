import { NextResponse } from "next/server";
import { resolveCollabLink } from "@/lib/server/collabContext";
import { getShareLink } from "@/lib/server/shareLinks";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { diffusedEspace, DIFFUSED_COLUMNS } from "@/lib/server/gentVersions";
import {
  MESSAGE_SIGNALEMENT,
  validerSignalement,
  type Appreciation,
  type MotifId,
  type Signalement,
} from "@/lib/signalement";
import {
  enregistrerSignalement,
  notifierSignalement,
  signalementsRecents,
} from "@/lib/server/signalements";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Signalement d'incident par l'utilisateur d'un gent partagé.
 *
 * ROUTE OUVERTE, et elle doit l'être : celui qui signale n'a pas de compte —
 * c'est précisément pour cela qu'il n'avait aucun moyen de se faire entendre.
 * L'autorisation vient du JETON du lien, comme pour la conversation : sans un
 * jeton valide, on ne peut pas déposer de signalement.
 *
 * Limitée en débit : une route ouverte qui envoie des e-mails est un
 * distributeur de courrier indésirable si on la laisse sans garde-fou.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = params.token;

  const lien = await getShareLink(token);
  if (!lien) return NextResponse.json({ error: "lien_inconnu" }, { status: 404 });

  // Trois signalements par heure et par lien : au-delà, ce n'est plus un
  // retour d'usage. Le plafond porte sur le LIEN et non sur l'adresse IP, que
  // l'on n'enregistre pas — et il se lit dans la table des signalements
  // elle-même, plutôt que d'inventer un compteur de plus.
  if ((await signalementsRecents(token, 3600)) >= 3) {
    return NextResponse.json(
      { error: "Vous avez déjà envoyé plusieurs signalements. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let body: { appreciation?: unknown; motif?: unknown; precision?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const signalement: Signalement = {
    appreciation:
      body.appreciation === "oui" || body.appreciation === "non"
        ? (body.appreciation as Appreciation)
        : null,
    motif:
      body.motif === "resultat" || body.motif === "conversation" || body.motif === "anomalie"
        ? (body.motif as MotifId)
        : null,
    precision: typeof body.precision === "string" ? body.precision : "",
  };

  const probleme = validerSignalement(signalement);
  if (probleme) {
    return NextResponse.json({ error: MESSAGE_SIGNALEMENT[probleme] }, { status: 400 });
  }

  // La base D'ABORD, la notification ENSUITE : un e-mail perdu ne doit pas
  // effacer le retour de quelqu'un qui a pris la peine de l'écrire.
  const enregistre = await enregistrerSignalement({
    gentId: lien.gentId,
    token,
    signalement,
  });

  if (!enregistre.ok) {
    return NextResponse.json(
      { error: "Votre signalement n'a pas pu être enregistré. Réessayez dans un instant." },
      { status: 503 }
    );
  }

  const nomGent = await nomDuGent(lien.gentId);
  // Pas attendue : le visiteur n'a pas à patienter derrière notre messagerie,
  // et son signalement est déjà en sécurité.
  void notifierSignalement({
    gentId: lien.gentId,
    nomGent,
    signalement,
    reportId: enregistre.id,
  });

  return NextResponse.json({ ok: true });
}

async function nomDuGent(gentId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return "votre gent";
  const { data } = await supabase
    .from("published_gents")
    .select(DIFFUSED_COLUMNS)
    .eq("id", gentId)
    .maybeSingle();
  return diffusedEspace(data)?.name ?? "votre gent";
}
