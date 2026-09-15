import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getUser } from "@/lib/server/session";
import { resolveCollabLink } from "@/lib/server/collabContext";
import {
  createCollabParticipant,
  describeCollabFailure,
  getCollabParticipant,
  getOrCreateCollabSession,
  insertCollabMessage,
  listCollabParticipants,
  patchCollabSynthesis,
} from "@/lib/server/collab";
import { tickCollabOrchestrator } from "@/lib/server/collabOrchestrator";
import { initialSynthesis } from "@/lib/collabOrchestrator";
import { COLLAB_GENT_AUTHOR, COLLAB_ROOM_CHANNEL, normalizeCollabName } from "@/lib/collab";

export const dynamic = "force-dynamic";
// L'arrivée attend le premier tick de l'orchestrateur (un appel LLM).
// 300 s, comme /api/chat, et non 120. Une requete de ce salon peut porter
// DEUX ticks : celui qui traite le message, puis, quand la collecte
// s'acheve, celui qui produit les propositions — gros modele et recherche
// web. Au-dela du plafond, Vercel tue la fonction, le `finally` qui relache
// le verrou d'orchestration n'est jamais execute, et le salon reste muet
// jusqu'a expiration du verrou. Observe en production : verrou pris a
// 14:00:00 par le tick de propositions, jamais relache.
export const maxDuration = 300;

interface Params {
  params: { token: string };
}

/**
 * Arrivée d'un participant dans le salon : un prénom suffit, pas de compte.
 * Renvoie un `participantToken` non devinable que le navigateur conserve en
 * localStorage et présente à chaque requête — c'est lui qui prouve l'identité.
 *
 * Réouverture : si le navigateur présente un participantToken encore valide
 * pour CE salon, on rend le participant existant plutôt que d'en créer un
 * double à chaque rafraîchissement.
 */
export async function POST(req: Request, { params }: Params) {
  const lien = await resolveCollabLink(params.token);
  if (!lien.ok) return lien.response;
  const { link, espace, collab } = lien.value;

  let body: { name?: unknown; participantToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const session = await getOrCreateCollabSession(link.token, link.gentId);

    // Réouverture : le jeton présenté doit appartenir à CE salon — un jeton
    // valide d'un AUTRE salon ne donne rien ici.
    const reclaim = typeof body.participantToken === "string" ? body.participantToken : null;
    if (reclaim) {
      const known = await getCollabParticipant(reclaim);
      if (known && known.sessionId === session.id) {
        return NextResponse.json({
          participantToken: reclaim,
          me: known.participant,
          sessionId: session.id,
          status: session.status,
        });
      }
    }

    const name = normalizeCollabName(body.name);
    if (!name) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

    // Badge « Créateur » : propriétaire connecté ET rôle studio « organisateur ».
    // En mode « membre », le propriétaire rejoint comme tout le monde.
    const role = await roleOfCaller(link.gentId, collab.roleCreateur);

    // Premier arrivé : le salon s'ouvre par le mot de bienvenue du gent,
    // posé d'emblée pour que l'écran ne soit jamais muet — avant même que
    // l'orchestrateur ne prenne la main.
    const dejaLa = await listCollabParticipants(session.id);
    const created = await createCollabParticipant({ sessionId: session.id, name, role });

    if (dejaLa.length === 0) {
      const gentName = espace.gent || espace.name;
      await insertCollabMessage({
        sessionId: session.id,
        channel: COLLAB_ROOM_CHANNEL,
        author: COLLAB_GENT_AUTHOR,
        authorName: gentName,
        kind: "system",
        text:
          `Bienvenue dans le salon ! Ma mission : ${collab.mission?.trim() || espace.name}. ` +
          "Je collecte les informations de chacun en privé, je vérifie les options, " +
          "puis je vous propose une décision ici.",
      });
      // L'onglet Synthèse ne doit pas attendre le premier tick réussi pour
      // exister : on la sème dès l'ouverture, l'orchestrateur l'enrichit ensuite.
      await patchCollabSynthesis(
        session.id,
        initialSynthesis(gentName, collab.mission?.trim() || espace.name)
      );
    }

    // L'arrivée d'un participant concerne l'orchestrateur : à lui d'engager
    // la collecte en privé. Awaité (et non en tâche de fond) : en serverless,
    // le travail survivant à la réponse peut être tué en vol.
    const orchestrator = await tickCollabOrchestrator(params.token);

    return NextResponse.json({
      participantToken: created.participantToken,
      me: created.participant,
      sessionId: session.id,
      status: session.status,
      orchestrator: orchestrator.ok
        ? { ok: true as const }
        : { ok: false as const, reason: orchestrator.reason },
    });
  } catch (e) {
    const { error, hint, status } = describeCollabFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}

/**
 * Rôle du nouvel arrivant : « organizer » seulement si la requête porte la
 * session du compte PROPRIÉTAIRE du gent ET que le studio a choisi
 * `roleCreateur: "organisateur"`. Sinon, même le propriétaire est un
 * participant ordinaire (mode « membre »). Sans authentification (dev local
 * sans compte), tout le monde reste participant.
 */
async function roleOfCaller(
  gentId: string,
  roleCreateur: "membre" | "organisateur" | undefined
) {
  try {
    if (roleCreateur !== "organisateur") return "participant" as const;
    const user = await getUser();
    if (!user) return "participant" as const;
    const supabase = getSupabaseAdmin();
    if (!supabase) return "participant" as const;
    const { data } = await supabase
      .from("published_gents")
      .select("owner_id")
      .eq("id", gentId)
      .maybeSingle();
    const owner = (data?.owner_id as string | null) ?? null;
    return owner && owner === user.id ? ("organizer" as const) : ("participant" as const);
  } catch {
    return "participant" as const;
  }
}
