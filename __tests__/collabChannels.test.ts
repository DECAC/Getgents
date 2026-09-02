import {
  COLLAB_ROOM_CHANNEL,
  channelVisibleToGent,
  channelVisibleToParticipant,
  collabProgress,
  gentChannel,
  messagesForGent,
  messagesForParticipant,
  normalizeCollabName,
  participantAnsweredCount,
  peerChannel,
  peerMembers,
  resolveSendChannel,
  type CollabMessage,
  type CollabParticipant,
} from "@/lib/collab";

const ALICE = "p_alice";
const BOB = "p_bob";
const CARO = "p_caro";

function msg(channel: string, author = ALICE): CollabMessage {
  return { id: 1, channel, author, authorName: author, kind: "text", text: "x", createdAt: "" };
}

describe("canaux du gent collaboratif", () => {
  it("rend le fil peer unique quel que soit l'initiateur (ids triés)", () => {
    expect(peerChannel(BOB, ALICE)).toBe(peerChannel(ALICE, BOB));
    expect(peerChannel(BOB, ALICE)).toBe(`peer:${ALICE}:${BOB}`);
  });

  it("lit les membres d'un canal peer, et refuse les autres formes", () => {
    expect(peerMembers(peerChannel(ALICE, BOB))).toEqual([ALICE, BOB]);
    expect(peerMembers(COLLAB_ROOM_CHANNEL)).toBeNull();
    expect(peerMembers(gentChannel(ALICE))).toBeNull();
    expect(peerMembers("peer:")).toBeNull();
  });

  it("un participant voit le salon, SON fil gent, et SES peer — jamais ceux d'autrui", () => {
    // Alice
    expect(channelVisibleToParticipant(COLLAB_ROOM_CHANNEL, ALICE)).toBe(true);
    expect(channelVisibleToParticipant(gentChannel(ALICE), ALICE)).toBe(true);
    expect(channelVisibleToParticipant(peerChannel(ALICE, BOB), ALICE)).toBe(true);
    // Le privé de Bob et le MP Bob↔Caro ne regardent pas Alice.
    expect(channelVisibleToParticipant(gentChannel(BOB), ALICE)).toBe(false);
    expect(channelVisibleToParticipant(peerChannel(BOB, CARO), ALICE)).toBe(false);
  });

  it("le gent ne reçoit JAMAIS les conversations entre participants", () => {
    expect(channelVisibleToGent(COLLAB_ROOM_CHANNEL)).toBe(true);
    expect(channelVisibleToGent(gentChannel(ALICE))).toBe(true);
    expect(channelVisibleToGent(peerChannel(ALICE, BOB))).toBe(false);
  });

  it("filtre une liste de messages pour un participant comme pour le gent", () => {
    const tout = [
      msg(COLLAB_ROOM_CHANNEL),
      msg(gentChannel(ALICE), "gent"),
      msg(gentChannel(BOB), "gent"),
      msg(peerChannel(ALICE, BOB), BOB),
      msg(peerChannel(BOB, CARO), CARO),
    ];
    expect(messagesForParticipant(tout, ALICE).map((m) => m.channel)).toEqual([
      COLLAB_ROOM_CHANNEL,
      gentChannel(ALICE),
      peerChannel(ALICE, BOB),
    ]);
    expect(messagesForParticipant(tout, BOB).map((m) => m.channel)).toEqual([
      COLLAB_ROOM_CHANNEL,
      gentChannel(BOB),
      peerChannel(ALICE, BOB),
      peerChannel(BOB, CARO),
    ]);
    expect(messagesForGent(tout).map((m) => m.channel)).toEqual([
      COLLAB_ROOM_CHANNEL,
      gentChannel(ALICE),
      gentChannel(BOB),
    ]);
  });
});

describe("cible d'envoi normalisée côté serveur", () => {
  const known = [ALICE, BOB, CARO];

  it("traduit salon et fil gent", () => {
    expect(resolveSendChannel({ kind: "room" }, ALICE, known)).toBe(COLLAB_ROOM_CHANNEL);
    expect(resolveSendChannel({ kind: "gent" }, ALICE, known)).toBe(gentChannel(ALICE));
  });

  it("traduit un MP vers un pair connu", () => {
    expect(resolveSendChannel({ kind: "peer", participantId: BOB }, ALICE, known)).toBe(
      peerChannel(ALICE, BOB)
    );
  });

  it("refuse un MP vers soi-même, un inconnu, ou vide", () => {
    expect(resolveSendChannel({ kind: "peer", participantId: ALICE }, ALICE, known)).toBeNull();
    expect(resolveSendChannel({ kind: "peer", participantId: "p_inconnu" }, ALICE, known)).toBeNull();
    expect(resolveSendChannel({ kind: "peer", participantId: "" }, ALICE, known)).toBeNull();
  });
});

describe("progression de la collecte", () => {
  const participants: CollabParticipant[] = [
    { id: ALICE, name: "Alice", role: "organizer", lastSeenAt: "" },
    { id: BOB, name: "Bob", role: "participant", lastSeenAt: "" },
    { id: CARO, name: "Caro", role: "participant", lastSeenAt: "" },
  ];

  it("compte les réponses renseignées, en ignorant les vides", () => {
    const collection = {
      [ALICE]: { dispos: "3 et 10 oct", budget: "" },
      [BOB]: { dispos: "10 oct", budget: "ok" },
    };
    expect(participantAnsweredCount(collection, ALICE)).toBe(1);
    expect(participantAnsweredCount(collection, BOB)).toBe(2);
    expect(participantAnsweredCount(collection, CARO)).toBe(0);
  });

  it("n'expose que des compteurs — jamais les verbatim", () => {
    const collection = {
      [ALICE]: { q1: "v1", q2: "v2" },
      [BOB]: { q1: "v1" },
    };
    const progress = collabProgress(participants, collection, 2);
    expect(progress.answered).toBe(1); // Alice seule a tout rempli
    expect(progress.total).toBe(3);
    expect(progress.perParticipant[ALICE]).toEqual({ answered: 2, done: true });
    expect(progress.perParticipant[BOB]).toEqual({ answered: 1, done: false });
    expect(progress.perParticipant[CARO]).toEqual({ answered: 0, done: false });
    // Garantie de forme : aucune valeur de réponse ne transite par là.
    expect(JSON.stringify(progress)).not.toContain("v1");
  });

  it("sans question configurée, une seule réponse suffit à marquer « a répondu »", () => {
    const progress = collabProgress(participants, { [BOB]: { note: "ok" } }, 0);
    expect(progress.perParticipant[BOB].done).toBe(true);
    expect(progress.perParticipant[ALICE].done).toBe(false);
  });
});

describe("prénom de participant", () => {
  it("normalise les espaces et accepte un prénom simple", () => {
    expect(normalizeCollabName("  Camille   Durand ")).toBe("Camille Durand");
  });

  it("refuse vide, trop long, ou non textuel", () => {
    expect(normalizeCollabName("   ")).toBeNull();
    expect(normalizeCollabName("x".repeat(41))).toBeNull();
    expect(normalizeCollabName(42)).toBeNull();
    expect(normalizeCollabName(undefined)).toBeNull();
  });
});
