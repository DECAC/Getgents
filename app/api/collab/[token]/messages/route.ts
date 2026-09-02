import { NextResponse } from "next/server";
import { resolveCollabLink } from "@/lib/server/collabContext";
import {
  describeCollabFailure,
  getCollabParticipant,
  getCollabSession,
  insertCollabMessage,
  listCollabParticipants,
} from "@/lib/server/collab";
import {
  COLLAB_MESSAGE_MAX_CHARS,
  resolveSendChannel,
  type CollabSendTarget,
} from "@/lib/collab";
import { canChat } from "@/lib/shareLink";

export const dynamic = "force-dynamic";

interface Params {
  params: { token: string };
}

/**
 * Envoi d'un message par un participant : salon, fil privé avec le gent, ou
 * MP vers un autre participant.
 *
 * Le client ne fournit JAMAIS la chaîne de canal brute : il désigne une cible
 * (« room », « gent », ou l'id d'un pair) et le serveur seul la traduit en
 * canal canonique — après avoir vérifié que le pair existe dans ce salon et
 * n'est pas l'expéditeur. Impossible ainsi d'écrire dans le fil d'un tiers.
 */
export async function POST(req: Request, { params }: Params) {
  const lien = await resolveCollabLink(params.token);
  if (!lien.ok) return lien.response;
  const { link } = lien.value;

  // Parler par le lien suit la même permission que le chat d'un partage.
  if (!canChat(link)) return NextResponse.json({ error: "link_unavailable" }, { status: 403 });

  let body: { participantToken?: unknown; target?: CollabSendTarget; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const participantToken = typeof body.participantToken === "string" ? body.participantToken : "";
  if (!participantToken) {
    return NextResponse.json({ error: "participant_required" }, { status: 401 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  if (text.length > COLLAB_MESSAGE_MAX_CHARS) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  const target = body.target;
  if (!target || (target.kind !== "room" && target.kind !== "gent" && target.kind !== "peer")) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  try {
    const session = await getCollabSession(link.token);
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    const who = await getCollabParticipant(participantToken);
    if (!who || who.sessionId !== session.id) {
      return NextResponse.json({ error: "participant_unknown" }, { status: 403 });
    }
    const me = who.participant;

    const participants = await listCollabParticipants(session.id);
    const channel = resolveSendChannel(target, me.id, participants.map((p) => p.id));
    if (!channel) return NextResponse.json({ error: "invalid_target" }, { status: 400 });

    const message = await insertCollabMessage({
      sessionId: session.id,
      channel,
      author: me.id,
      authorName: me.name,
      kind: "text",
      text,
    });

    return NextResponse.json({ message });
  } catch (e) {
    const { error, hint, status } = describeCollabFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
