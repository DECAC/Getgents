import { NextResponse } from "next/server";
import { resolveCollabLink } from "@/lib/server/collabContext";
import {
  describeCollabFailure,
  getCollabParticipant,
  getCollabSession,
  insertCollabMessage,
  listCollabParticipants,
  listRecentCollabMessages,
} from "@/lib/server/collab";
import { tickCollabOrchestrator } from "@/lib/server/collabOrchestrator";
import {
  COLLAB_MESSAGE_MAX_CHARS,
  COLLAB_ROOM_CHANNEL,
  channelVisibleToGent,
  resolveSendChannel,
  type CollabProposalPayload,
  type CollabSendTarget,
} from "@/lib/collab";
import { canChat } from "@/lib/shareLink";

export const dynamic = "force-dynamic";
// L'envoi attend le tick de l'orchestrateur (un appel LLM) : sans ce plafond
// relevé, un salon actif dépasserait la durée par défaut de la plateforme.
export const maxDuration = 120;

interface Params {
  params: { token: string };
}

/**
 * Envoi d'un message par un participant : salon, fil privé avec le gent, ou
 * MP vers un autre participant. Ou dépôt d'un VOTE sur une proposition.
 *
 * Le client ne fournit JAMAIS la chaîne de canal brute : il désigne une cible
 * (« room », « gent », ou l'id d'un pair) et le serveur seul la traduit en
 * canal canonique — après avoir vérifié que le pair existe dans ce salon et
 * n'est pas l'expéditeur. Impossible ainsi d'écrire dans le fil d'un tiers.
 *
 * Le tick de l'orchestrateur est AWAITÉ, pas lancé en tâche de fond : en
 * serverless, le travail survivant à la réponse peut être tué en vol — la
 * réponse du gent ne partirait jamais. Le client, lui, affiche le message
 * dès l'envoi et ne dépend pas de cette attente.
 */
export async function POST(req: Request, { params }: Params) {
  const lien = await resolveCollabLink(params.token);
  if (!lien.ok) return lien.response;
  const { link } = lien.value;

  // Parler par le lien suit la même permission que le chat d'un partage.
  if (!canChat(link)) return NextResponse.json({ error: "link_unavailable" }, { status: 403 });

  let body: {
    participantToken?: unknown;
    target?: CollabSendTarget;
    text?: unknown;
    vote?: { proposalId?: unknown; optionId?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const participantToken = typeof body.participantToken === "string" ? body.participantToken : "";
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

    // ── Vote sur une proposition du salon ─────────────────────────────
    if (body.vote && typeof body.vote === "object") {
      const proposalId = typeof body.vote.proposalId === "number" ? body.vote.proposalId : null;
      const optionId = typeof body.vote.optionId === "string" ? body.vote.optionId : "";
      const recents = await listRecentCollabMessages(session.id);
      const proposal = recents.find(
        (m) => m.id === proposalId && m.kind === "proposal" && m.channel === COLLAB_ROOM_CHANNEL
      );
      const option = (proposal?.payload as CollabProposalPayload | undefined)?.options.find(
        (o) => o.id === optionId
      );
      if (!proposal || !option) {
        return NextResponse.json({ error: "invalid_vote" }, { status: 400 });
      }
      const message = await insertCollabMessage({
        sessionId: session.id,
        channel: COLLAB_ROOM_CHANNEL,
        author: me.id,
        authorName: me.name,
        kind: "vote",
        text: option.title,
        payload: { proposalId: proposal.id, optionId },
      });
      await tickCollabOrchestrator(params.token);
      return NextResponse.json({ message });
    }

    // ── Message texte ─────────────────────────────────────────────────
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "empty_message" }, { status: 400 });
    if (text.length > COLLAB_MESSAGE_MAX_CHARS) {
      return NextResponse.json({ error: "message_too_long" }, { status: 400 });
    }

    const target = body.target;
    if (!target || (target.kind !== "room" && target.kind !== "gent" && target.kind !== "peer")) {
      return NextResponse.json({ error: "invalid_target" }, { status: 400 });
    }

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

    // L'orchestrateur n'est réveillé que par ce qu'il a le droit de voir :
    // un MP entre participants ne doit pas même lui signaler qu'il s'en
    // est passé quelque chose.
    if (channelVisibleToGent(channel)) {
      await tickCollabOrchestrator(params.token);
    }

    return NextResponse.json({ message });
  } catch (e) {
    const { error, hint, status } = describeCollabFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
