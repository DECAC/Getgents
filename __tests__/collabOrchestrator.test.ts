import { extractJsonFromHtmlMarker } from "@/lib/server/markerJson";
import {
  COLLAB_ACTION_MARKER,
  buildOrchestratorStateMessage,
  buildOrchestratorSystemPrompt,
  parseOrchestratorActions,
  validateOrchestratorAction,
  type OrchestratorParseContext,
} from "@/lib/collabOrchestrator";
import {
  COLLAB_ROOM_CHANNEL,
  collabProgress,
  collabVoteTallies,
  gentChannel,
  messagesForGent,
  peerChannel,
  type CollabMessage,
} from "@/lib/collab";
import type { CollabConfig } from "@/lib/types";

const ALICE = "p_alice";
const BOB = "p_bob";
const CTX: OrchestratorParseContext = { participantIds: [ALICE, BOB], questionIds: ["dispos", "budget"] };

/** Réponse complète du modèle → actions validées (chaîne réelle de parsing). */
function parseReponse(raw: string) {
  const json = extractJsonFromHtmlMarker(raw, COLLAB_ACTION_MARKER);
  return parseOrchestratorActions(json ? JSON.parse(json) : null, CTX);
}

describe("parsing des actions de l'orchestrateur", () => {
  it("accepte une rafale complète et valide", () => {
    const actions = parseReponse(
      `Très bien.` +
        `<!--${COLLAB_ACTION_MARKER}: {"actions":[` +
        `{"type":"room_message","text":"Bienvenue !"},` +
        `{"type":"dm","participant":"${ALICE}","text":"Quels samedis ?","questions":[{"q":"Dispos ?","options":["3 oct","10 oct"]}]},` +
        `{"type":"record","participant":"${ALICE}","questionId":"dispos","value":"3 et 10 oct"},` +
        `{"type":"synthesis","patch":{"pending":["En attente de Bob"],"decision":{"title":"À trancher"}}},` +
        `{"type":"propose","title":"3 options","options":[{"title":"A"},{"title":"B","price":"95 €","verified":true}]},` +
        `{"type":"status","status":"proposing"}` +
        `]}-->`
    );
    expect(actions.map((a) => a.type)).toEqual([
      "room_message",
      "dm",
      "record",
      "synthesis",
      "propose",
      "status",
    ]);
  });

  it("rejette un DM vers un participant inconnu", () => {
    expect(
      validateOrchestratorAction({ type: "dm", participant: "p_inconnu", text: "salut" }, CTX)
    ).toBeNull();
  });

  it("rejette un record vers une question non déclarée", () => {
    expect(
      validateOrchestratorAction(
        { type: "record", participant: ALICE, questionId: "inventee", value: "x" },
        CTX
      )
    ).toBeNull();
  });

  it("rejette une proposition à moins de deux options", () => {
    expect(
      validateOrchestratorAction({ type: "propose", title: "t", options: [{ title: "A" }] }, CTX)
    ).toBeNull();
  });

  it("filtre les clés de synthèse hors liste blanche", () => {
    const action = validateOrchestratorAction(
      { type: "synthesis", patch: { pending: ["a"], systemPrompt: "détourné", secret: 1 } },
      CTX
    );
    expect(action).toEqual({ type: "synthesis", patch: { pending: ["a"] } });
  });

  it("borne la taille des textes et le nombre d'actions", () => {
    expect(
      validateOrchestratorAction({ type: "room_message", text: "x".repeat(2001) }, CTX)
    ).toBeNull();
    const rafale = Array.from({ length: 30 }, () => ({ type: "nothing" }));
    const actions = parseOrchestratorActions({ actions: rafale }, CTX);
    expect(actions.length).toBeLessThanOrEqual(12);
  });

  it("tombe sur nothing sans bloc valide — jamais d'action sauvage", () => {
    expect(parseOrchestratorActions(null, CTX)).toEqual([{ type: "nothing" }]);
    expect(parseOrchestratorActions({ actions: "pas un tableau" }, CTX)).toEqual([
      { type: "nothing" },
    ]);
    expect(parseOrchestratorActions({ actions: [{ type: "sabotage" }] }, CTX)).toEqual([
      { type: "nothing" },
    ]);
  });
});

describe("prompt de l'orchestrateur", () => {
  const collab: CollabConfig = {
    enabled: true,
    mission: "Trouver la journée team building",
    cadre: { budget: "150 €/pers", lieu: "< 1 h de Paris" },
    questions: [{ id: "dispos", label: "Quels samedis ?", kind: "dates", required: true }],
  };
  const participants = [
    { id: ALICE, name: "Alice", role: "organizer" as const, lastSeenAt: "" },
    { id: BOB, name: "Bob", role: "participant" as const, lastSeenAt: "" },
  ];
  const base = {
    gentName: "Event Manager",
    espace: { name: "Team Building", systemPrompt: "Ton enjoué." },
    collab,
    status: "collecting" as const,
    participants,
    collection: { [ALICE]: { dispos: "3 et 10 oct" } },
    synthesis: {},
    orchestrationCount: 0,
    maxOrchestrations: 200,
    messages: [],
  };

  it("porte la mission, le cadre, les questions et les réponses collectées", () => {
    const sys = buildOrchestratorSystemPrompt(base);
    expect(sys).toContain("Trouver la journée team building");
    expect(sys).toContain("150 €/pers");
    expect(sys).toContain("[dispos] (dates) Quels samedis ?");
    expect(sys).toContain("publie exactement 3 options");
    const msg = buildOrchestratorStateMessage(base);
    expect(msg).toContain("Alice");
    expect(msg).toContain("3 et 10 oct");
  });

  it("n'injecte JAMAIS un message peer dans le contexte", () => {
    const messages: CollabMessage[] = [
      { id: 1, channel: COLLAB_ROOM_CHANNEL, author: ALICE, authorName: "Alice", kind: "text", text: "salon", createdAt: "" },
      { id: 2, channel: gentChannel(ALICE), author: ALICE, authorName: "Alice", kind: "text", text: "privé", createdAt: "" },
      { id: 3, channel: peerChannel(ALICE, BOB), author: ALICE, authorName: "Alice", kind: "text", text: "SECRET-ENTRE-EUX", createdAt: "" },
    ];
    const msg = buildOrchestratorStateMessage({ ...base, messages: messagesForGent(messages) });
    expect(msg).toContain("salon");
    expect(msg).toContain("privé");
    expect(msg).not.toContain("SECRET-ENTRE-EUX");
  });
});

describe("cycle join → message → tick (niveau pur)", () => {
  it("un participant rejoint, répond en privé, la collecte avance", () => {
    // Join : deux participants.
    const participants = [
      { id: ALICE, name: "Alice", role: "organizer" as const, lastSeenAt: "" },
      { id: BOB, name: "Bob", role: "participant" as const, lastSeenAt: "" },
    ];
    let collection: Record<string, Record<string, unknown>> = {};
    expect(collabProgress(participants, collection, 1).answered).toBe(0);

    // Bob répond en privé ; le tick décide d'un record — validé puis appliqué.
    const action = validateOrchestratorAction(
      { type: "record", participant: BOB, questionId: "dispos", value: "10 oct" },
      CTX
    );
    expect(action).not.toBeNull();
    if (action?.type === "record") {
      collection = {
        ...collection,
        [action.participant]: { ...(collection[action.participant] ?? {}), [action.questionId]: action.value },
      };
    }
    const progress = collabProgress(participants, collection, 1);
    expect(progress.answered).toBe(1);
    expect(progress.perParticipant[BOB].done).toBe(true);
    expect(progress.perParticipant[ALICE].done).toBe(false);
  });
});

describe("dépouillement des votes", () => {
  const vote = (id: number, author: string, proposalId: number, optionId: string): CollabMessage => ({
    id,
    channel: COLLAB_ROOM_CHANNEL,
    author,
    authorName: author,
    kind: "vote",
    text: optionId,
    payload: { proposalId, optionId },
    createdAt: "",
  });

  it("compte les voix, le dernier vote de chacun faisant foi", () => {
    const messages = [
      vote(1, ALICE, 100, "a"),
      vote(2, BOB, 100, "b"),
      vote(3, ALICE, 100, "b"), // Alice déplace son choix
    ];
    const tally = collabVoteTallies(messages, ALICE)["100"];
    expect(tally.counts).toEqual({ b: 2 });
    expect(tally.voters).toBe(2);
    expect(tally.my).toBe("b");
  });

  it("isole les propositions et ignore les bulletins malformés", () => {
    const messages = [
      vote(1, ALICE, 100, "a"),
      vote(2, BOB, 200, "x"),
      { id: 3, channel: COLLAB_ROOM_CHANNEL, author: BOB, authorName: "Bob", kind: "vote" as const, text: "", payload: { optionId: "sans-proposal" }, createdAt: "" },
    ];
    const tallies = collabVoteTallies(messages, BOB);
    expect(tallies["100"].counts).toEqual({ a: 1 });
    expect(tallies["200"].my).toBe("x");
    expect(Object.keys(tallies)).toHaveLength(2);
  });
});
