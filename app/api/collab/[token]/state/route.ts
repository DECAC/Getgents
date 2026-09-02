import { NextResponse } from "next/server";
import { resolveCollabLink } from "@/lib/server/collabContext";
import {
  describeCollabFailure,
  getCollabParticipant,
  getCollabSession,
  listCollabParticipants,
  listRecentCollabMessages,
  touchCollabParticipant,
} from "@/lib/server/collab";
import { collabProgress, messagesForParticipant } from "@/lib/collab";

export const dynamic = "force-dynamic";

interface Params {
  params: { token: string };
}

/**
 * État complet du salon POUR UN participant — le seul point de lecture, pensé
 * pour le polling (toutes les 4 s côté client).
 *
 * Le filtrage de visibilité est fait ICI, côté serveur, par les fonctions
 * pures de lib/collab.ts : le navigateur ne reçoit jamais le fil privé d'un
 * autre participant, ni les conversations entre deux tiers. La collection
 * brute (verbatim des réponses) ne sort pas non plus — seule la progression
 * en compteurs, et la synthèse écrite pour tous.
 */
export async function GET(req: Request, { params }: Params) {
  const lien = await resolveCollabLink(params.token);
  if (!lien.ok) return lien.response;
  const { link, espace, collab } = lien.value;

  const participantToken = new URL(req.url).searchParams.get("participant") ?? "";
  if (!participantToken) {
    return NextResponse.json({ error: "participant_required" }, { status: 401 });
  }

  try {
    const session = await getCollabSession(link.token);
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    const who = await getCollabParticipant(participantToken);
    if (!who || who.sessionId !== session.id) {
      return NextResponse.json({ error: "participant_unknown" }, { status: 403 });
    }
    const me = who.participant;

    const [participants, tousLesMessages] = await Promise.all([
      listCollabParticipants(session.id),
      listRecentCollabMessages(session.id),
    ]);

    // Présence, best-effort et APRÈS les lectures : elle ne doit rien retarder.
    void touchCollabParticipant(me.id);

    const questions = collab.questions ?? [];
    return NextResponse.json({
      gent: { name: espace.gent || espace.name, icon: espace.icon },
      mission: collab.mission?.trim() || espace.name,
      cadre: collab.cadre ?? {},
      status: session.status,
      me,
      participants,
      questions,
      progress: collabProgress(participants, session.collection, questions.length),
      synthesis: session.synthesis,
      messages: messagesForParticipant(tousLesMessages, me.id),
    });
  } catch (e) {
    const { error, hint, status } = describeCollabFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
