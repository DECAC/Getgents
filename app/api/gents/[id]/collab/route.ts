import { NextResponse } from "next/server";
import { requireGentAccess } from "@/lib/server/gentGuard";
import { diffusedEspace } from "@/lib/server/gentVersions";
import {
  describeCollabFailure,
  listCollabParticipants,
  listCollabSessionsForGent,
  listRecentCollabMessages,
} from "@/lib/server/collab";
import {
  COLLAB_ROOM_CHANNEL,
  collabProgress,
  type CollabMessage,
  type CollabSessionStatus,
} from "@/lib/collab";

export const dynamic = "force-dynamic";

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/i;

interface Params {
  params: { id: string };
}

const STATUS_LABEL: Record<CollabSessionStatus, string> = {
  collecting: "Collecte en cours",
  proposing: "Propositions / vote",
  done: "Mission terminée",
};

/**
 * Suivi créateur d'un gent Event Manager / collaboratif.
 *
 * Réservé au propriétaire (admin) : participants, progression de collecte,
 * synthèse, et lecture du SALON uniquement — jamais les fils privés gent↔
 * participant ni les MP entre participants (confidentialité).
 */
export async function GET(_req: Request, { params }: Params) {
  if (!ID_RE.test(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const acces = await requireGentAccess(params.id, "admin");
  if (!acces.ok) return acces.response;

  const espace = diffusedEspace(acces.value.row);
  const collab = espace?.collab;
  if (!collab?.enabled) {
    return NextResponse.json({ enabled: false, sessions: [] });
  }

  const questionsCount = (collab.questions ?? []).length;

  try {
    const sessions = await listCollabSessionsForGent(params.id);
    const detailed = await Promise.all(
      sessions.map(async (session) => {
        const [participants, allMessages] = await Promise.all([
          listCollabParticipants(session.id),
          listRecentCollabMessages(session.id, 200),
        ]);
        const roomMessages: CollabMessage[] = allMessages.filter(
          (m) => m.channel === COLLAB_ROOM_CHANNEL
        );
        const progress = collabProgress(participants, session.collection, questionsCount);
        return {
          id: session.id,
          token: session.token,
          status: session.status,
          statusLabel: STATUS_LABEL[session.status],
          createdAt: session.createdAt,
          orchestrationCount: session.orchestrationCount,
          maxOrchestrations: session.maxOrchestrations,
          participants: participants.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            lastSeenAt: p.lastSeenAt,
            answered: progress.perParticipant[p.id]?.answered ?? 0,
            done: progress.perParticipant[p.id]?.done ?? false,
          })),
          progress: { answered: progress.answered, total: progress.total, questionsCount },
          // Compteurs seulement — pas les verbatim de collection.
          synthesis: session.synthesis,
          roomMessages: roomMessages.slice(-40),
        };
      })
    );

    return NextResponse.json({
      enabled: true,
      mission: collab.mission ?? "",
      cadre: collab.cadre ?? {},
      sessions: detailed,
    });
  } catch (e) {
    const { error, hint, status } = describeCollabFailure(e);
    return NextResponse.json({ error, hint }, { status });
  }
}
