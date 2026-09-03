// Types et règles du gent collaboratif — module PUR, sans réseau ni base,
// utilisable côté serveur (routes, orchestrateur) comme côté client
// (CollabShell), et testable exhaustivement. Sur le modèle de lib/shareLink.ts.
//
// Règle d'or de la confidentialité : c'est ICI que se décide qui voit quoi,
// dans des fonctions pures, pour qu'un test puisse prouver qu'un participant
// ne voit jamais le fil privé d'un autre et que le gent ne reçoit jamais les
// conversations entre participants. Les routes appliquent ces fonctions,
// elles ne redécident rien.

export type CollabSessionStatus = "collecting" | "proposing" | "done";

export type CollabRole = "organizer" | "participant";

export type CollabMessageKind = "text" | "question" | "proposal" | "system" | "vote";

export interface CollabParticipant {
  id: string;
  name: string;
  role: CollabRole;
  lastSeenAt: string;
}

export interface CollabMessage {
  id: number;
  /** 'room' | 'gent:<participantId>' | 'peer:<idA>:<idB>' (ids triés). */
  channel: string;
  /** 'gent' ou l'id d'un participant. */
  author: string;
  authorName: string;
  kind: CollabMessageKind;
  text: string;
  payload?: unknown;
  createdAt: string;
}

/** Auteur réservé à l'orchestrateur dans la table des messages. */
export const COLLAB_GENT_AUTHOR = "gent";

/** Canal du salon commun : tout le monde, gent compris. */
export const COLLAB_ROOM_CHANNEL = "room";

/** Fil privé entre le gent et UN participant. */
export function gentChannel(participantId: string): string {
  return `gent:${participantId}`;
}

/**
 * Fil entre deux participants. Les ids sont TRIÉS : le canal est unique quel
 * que soit l'initiateur, et un simple préfixe ne permet pas de deviner le
 * fil de deux autres personnes sans connaître leurs deux ids.
 */
export function peerChannel(a: string, b: string): string {
  return `peer:${[a, b].sort().join(":")}`;
}

export function isPeerChannel(channel: string): boolean {
  return channel.startsWith("peer:");
}

export function isGentChannel(channel: string): boolean {
  return channel.startsWith("gent:");
}

/** Les deux ids d'un canal peer (triés), ou null si ce n'en est pas un. */
export function peerMembers(channel: string): [string, string] | null {
  if (!isPeerChannel(channel)) return null;
  const parts = channel.slice("peer:".length).split(":");
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}

/**
 * Ce qu'un PARTICIPANT a le droit de voir :
 * - le salon commun ;
 * - son fil privé avec le gent, et uniquement le sien ;
 * - les fils entre participants dont il est membre.
 *
 * Tout le reste — le privé d'un autre, un MP entre deux tiers — ne doit
 * jamais quitter le serveur pour lui.
 */
export function channelVisibleToParticipant(channel: string, participantId: string): boolean {
  if (channel === COLLAB_ROOM_CHANNEL) return true;
  if (channel === gentChannel(participantId)) return true;
  const members = peerMembers(channel);
  return members !== null && (members[0] === participantId || members[1] === participantId);
}

/**
 * Ce que le GENT a le droit de RECEVOIR dans son contexte : le salon et ses
 * fils privés avec chaque participant. Jamais les peer — une conversation
 * entre participants ne remonte ni en contexte ni en synthèse.
 */
export function channelVisibleToGent(channel: string): boolean {
  return channel === COLLAB_ROOM_CHANNEL || isGentChannel(channel);
}

/** Filtre les messages servis à un participant (route state). */
export function messagesForParticipant(messages: CollabMessage[], participantId: string): CollabMessage[] {
  return messages.filter((m) => channelVisibleToParticipant(m.channel, participantId));
}

/** Filtre les messages injectés dans le contexte de l'orchestrateur. */
export function messagesForGent(messages: CollabMessage[]): CollabMessage[] {
  return messages.filter((m) => channelVisibleToGent(m.channel));
}

/**
 * Canal d'envoi demandé par un participant, normalisé côté serveur.
 * Le client ne fournit jamais la chaîne brute : il dit « au salon », « au
 * gent » ou « à tel participant » — le serveur seul connaît la forme exacte
 * (et vérifie que le destinataire peer existe et n'est pas soi-même).
 */
export type CollabSendTarget =
  | { kind: "room" }
  | { kind: "gent" }
  | { kind: "peer"; participantId: string };

/** Résout la cible en canal canonique, ou null si elle est illégitime. */
export function resolveSendChannel(
  target: CollabSendTarget,
  fromId: string,
  knownParticipantIds: string[]
): string | null {
  if (target.kind === "room") return COLLAB_ROOM_CHANNEL;
  if (target.kind === "gent") return gentChannel(fromId);
  const other = target.participantId;
  if (!other || other === fromId) return null;
  if (!knownParticipantIds.includes(other)) return null;
  return peerChannel(fromId, other);
}

/** Progression de la collecte pour UN participant (dérivée de collection). */
export function participantAnsweredCount(
  collection: Record<string, Record<string, unknown>>,
  participantId: string
): number {
  const answers = collection[participantId];
  if (!answers || typeof answers !== "object") return 0;
  return Object.values(answers).filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== ""
  ).length;
}

/**
 * Progression affichée publiquement : COMPTEURS seulement. Les verbatim des
 * réponses restent privés (confidentialité par défaut : synthèses oui,
 * verbatim non) — le salon voit « 2/3 questions », jamais le contenu.
 */
export function collabProgress(
  participants: CollabParticipant[],
  collection: Record<string, Record<string, unknown>>,
  questionsCount: number
): { perParticipant: Record<string, { answered: number; done: boolean }>; answered: number; total: number } {
  const perParticipant: Record<string, { answered: number; done: boolean }> = {};
  let answered = 0;
  for (const p of participants) {
    const count = participantAnsweredCount(collection, p.id);
    const done = questionsCount > 0 ? count >= questionsCount : count > 0;
    perParticipant[p.id] = { answered: count, done };
    if (done) answered++;
  }
  return { perParticipant, answered, total: participants.length };
}

/** Contenu d'un message kind 'proposal' : options soumises au vote du groupe. */
export interface CollabProposalPayload {
  title: string;
  options: {
    id: string;
    title: string;
    where?: string;
    price?: string;
    verified?: boolean;
  }[];
}

/** Contenu d'un message kind 'question' : options cliquables en fil privé. */
export interface CollabQuestionPayload {
  questions: { q: string; options: string[]; multi?: boolean }[];
}

// ── Votes sur les propositions ───────────────────────────────────────────

/**
 * Dépouillement d'une proposition : voix par option, nombre de votants, et le
 * choix de l'appelant. Un vote est un message kind 'vote' au salon ; le
 * DERNIER vote d'un participant sur une proposition fait foi (on peut
 * déplacer son choix).
 */
export interface CollabVoteTally {
  counts: Record<string, number>;
  voters: number;
  my: string | null;
}

/** Messages en ordre chronologique ; clé du résultat : l'id du message proposal. */
export function collabVoteTallies(
  messages: CollabMessage[],
  meId: string
): Record<string, CollabVoteTally> {
  const byProposal = new Map<number, Map<string, string>>();
  for (const m of messages) {
    if (m.kind !== "vote" || !m.payload || typeof m.payload !== "object") continue;
    const p = m.payload as { proposalId?: unknown; optionId?: unknown };
    if (typeof p.proposalId !== "number" || typeof p.optionId !== "string") continue;
    let votes = byProposal.get(p.proposalId);
    if (!votes) byProposal.set(p.proposalId, (votes = new Map()));
    votes.set(m.author, p.optionId);
  }
  const out: Record<string, CollabVoteTally> = {};
  byProposal.forEach((votes, proposalId) => {
    const counts: Record<string, number> = {};
    let my: string | null = null;
    votes.forEach((optionId, author) => {
      counts[optionId] = (counts[optionId] ?? 0) + 1;
      if (author === meId) my = optionId;
    });
    out[String(proposalId)] = { counts, voters: votes.size, my };
  });
  return out;
}

/** Charge utile servie par GET /api/collab/[token]/state (déjà filtrée pour l'appelant). */
export interface CollabStatePayload {
  gent: { name: string; icon: string };
  mission: string;
  cadre: { budget?: string; lieu?: string; periode?: string; taille?: string };
  status: CollabSessionStatus;
  /** Mode de décision configuré par le créateur (défaut : vote du groupe). */
  decision: "vote" | "createur";
  me: CollabParticipant;
  participants: CollabParticipant[];
  questions: import("@/lib/types").CollabQuestion[];
  progress: {
    perParticipant: Record<string, { answered: number; done: boolean }>;
    answered: number;
    total: number;
  };
  synthesis: Record<string, unknown>;
  messages: CollabMessage[];
  /** Dépouillement des propositions du salon, par id de message proposal. */
  votes: Record<string, CollabVoteTally>;
}

/** Tronconne un texte de message à une taille raisonnable (garde-fou). */
export const COLLAB_MESSAGE_MAX_CHARS = 2000;

/** Bornes du prénom de participant. */
export const COLLAB_NAME_MAX_CHARS = 40;

export function normalizeCollabName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > COLLAB_NAME_MAX_CHARS) return null;
  return name;
}
