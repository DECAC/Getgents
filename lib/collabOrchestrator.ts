// Orchestrateur du gent collaboratif — partie PURE : construction du prompt
// et validation des actions renvoyées par le modèle. Aucune base, aucun
// réseau : tout est testable, et les règles de sécurité (ids de participants
// connus, questions déclarées, tailles bornées) sont prouvables par Jest.
//
// Le modèle répond avec UN bloc `<!--COLLAB: {"actions":[…]}-->` (même
// convention que les signaux existants du repo, voir lib/server/markerJson.ts)
// précédé d'un texte libre ignoré. Chaque action est validée CHAMP PAR CHAMP
// ici ; l'orchestrateur serveur n'applique que ce qui en sort.

import type { CollabConfig, CollabQuestion } from "@/lib/types";
import type { CollabMessage, CollabParticipant, CollabSessionStatus } from "@/lib/collab";
import { COLLAB_GENT_AUTHOR, COLLAB_ROOM_CHANNEL, gentChannel } from "@/lib/collab";

/** Marqueur HTML encadrant le JSON d'actions (parsé par extractJsonFromHtmlMarker). */
export const COLLAB_ACTION_MARKER = "COLLAB";

/** Question cliquable posée en privé (même forme que `questions` de ConversationMessage). */
export interface CollabAsk {
  q: string;
  options: string[];
  multi?: boolean;
}

/** Une carte de proposition soumise au vote du groupe. */
export interface CollabProposalOption {
  id: string;
  title: string;
  where?: string;
  price?: string;
  /** Mention « vérifié sur le web » affichée sur la carte. */
  verified?: boolean;
}

export type OrchestratorAction =
  | { type: "room_message"; text: string }
  | { type: "dm"; participant: string; text: string; questions?: CollabAsk[] }
  | { type: "record"; participant: string; questionId: string; value: string }
  | { type: "synthesis"; patch: Record<string, unknown> }
  | { type: "propose"; title: string; options: CollabProposalOption[] }
  | { type: "status"; status: CollabSessionStatus }
  | { type: "nothing" };

/** Contexte de validation : ce que le modèle a le droit de nommer. */
export interface OrchestratorParseContext {
  participantIds: string[];
  questionIds: string[];
}

// ── Prompt ───────────────────────────────────────────────────────────────

export interface OrchestratorPromptInput {
  gentName: string;
  espace: {
    name: string;
    systemPrompt?: string;
    webSearch?: boolean;
  };
  collab: CollabConfig;
  status: CollabSessionStatus;
  participants: CollabParticipant[];
  /** Réponses collectées — le gent y a droit, c'est lui qui collecte. */
  collection: Record<string, Record<string, unknown>>;
  /** Synthèse courante (peut être vide au démarrage). */
  synthesis: Record<string, unknown>;
  /** Messages récents DÉJÀ filtrés par messagesForGent — jamais de peer ici. */
  messages: CollabMessage[];
  orchestrationCount: number;
  maxOrchestrations: number;
}

const MAX_MESSAGES_IN_PROMPT = 80;

function fmtHeure(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Le message système de l'orchestrateur. Même philosophie que
 * buildGentSystemPrompt : la machinerie d'abord, les instructions du
 * créateur à la fin — la position que le modèle lit comme faisant autorité.
 */
export function buildOrchestratorSystemPrompt(input: OrchestratorPromptInput): string {
  const { collab, gentName } = input;
  const blocks: string[] = [];

  blocks.push(
    `Tu es « ${gentName} », le gent ORCHESTRATEUR d'une mission collective sur Getgents. ` +
      "Plusieurs participants échangent dans un salon ; toi seul vois l'ensemble (sauf leurs conversations privées entre eux, auxquelles tu n'as JAMAIS accès et que tu ne dois jamais mentionner). " +
      "Tu n'es pas un simple intervenant : tu MÈNES la mission de bout en bout."
  );

  blocks.push(
    `MISSION : ${collab.mission?.trim() || input.espace.name}.` +
      (collab.cadre && Object.values(collab.cadre).some(Boolean)
        ? `\nCADRE STRUCTURÉ (bornes non négociables) :` +
          (collab.cadre.budget ? `\n- Budget : ${collab.cadre.budget}` : "") +
          (collab.cadre.lieu ? `\n- Lieu : ${collab.cadre.lieu}` : "") +
          (collab.cadre.periode ? `\n- Période : ${collab.cadre.periode}` : "") +
          (collab.cadre.taille ? `\n- Taille du groupe : ${collab.cadre.taille}` : "")
        : "") +
      (collab.exclusions?.trim() ? `\nEXCLUSIONS (hors de propos) : ${collab.exclusions.trim()}` : "")
  );

  const questions = collab.questions ?? [];
  if (questions.length) {
    blocks.push(
      "QUESTIONS DE COLLECTE — à poser EN PRIVÉ à chaque participant, une ou deux à la fois, en reformulant avec ton style :\n" +
        questions
          .map((q) => {
            const kindNote =
              q.kind === "dates"
                ? q.options?.length
                  ? ` (suggestions de dates : ${q.options.join(" / ")} — accepte aussi une période en texte libre, ex. « les mardis à jeudi en octobre »)`
                  : " (dates ou période en texte libre, ex. « les mardis à jeudi en octobre »)"
                : q.options?.length
                  ? ` (options : ${q.options.join(" / ")})`
                  : "";
            return `- [${q.id}] (${q.kind}) ${q.label}${kindNote}${q.required ? " — OBLIGATOIRE" : ""}`;
          })
          .join("\n")
    );
  }

  const verbatim = collab.confidentialite?.verbatim === true;
  blocks.push(
    "CONFIDENTIALITÉ — règles absolues :\n" +
      "- Les réponses détaillées d'un participant restent PRIVÉES : au salon, tu n'en restitues que des synthèses" +
      (verbatim ? " (le créateur autorise le verbatim, mais reste sobre)." : " et jamais le verbatim.") +
      "\n- Ne révèle jamais à quelqu'un ce qu'un AUTRE a répondu en privé ; annonce des compteurs (« 5 réponses sur 8 »), pas des contenus nominatifs, sauf si la personne l'a elle-même dit au salon." +
      "\n- Ne mentionne jamais l'existence de conversations privées entre participants."
  );

  const optionsCible = Math.min(10, Math.max(2, collab.propositions?.options ?? 3));
  const decisionMode = collab.decision === "createur" ? "createur" : "vote";

  blocks.push(
    "COMMENT AGIR — tu réponds UNIQUEMENT par un bloc d'actions :\n" +
      `- \`room_message { text }\` : un message au salon (avancées, sondages, annonces). Sobre : une annonce utile vaut mieux que trois relances publiques.\n` +
      `- \`dm { participant, text, questions? }\` : un fil privé avec UN participant — collecte, relance, récapitulatif de ce que tu retiens. \`questions\` rend des options cliquables.\n` +
      `- \`record { participant, questionId, value }\` : enregistre la réponse d'un participant à une question de collecte, dès que son message y répond.\n` +
      `- \`synthesis { patch }\` : mets à jour le récapitulatif vivant (clés : decision {icon,title,sub,status}, facts [{icon,k,v,s}], pending [textes], timeline [{at,text}] — la timeline est réécrite ENTIÈRE, recopie-la en l'allongeant).\n` +
      `- \`propose { title, options [{id,title,where,price,verified}] }\` : publie exactement ${optionsCible} options` +
      (decisionMode === "vote"
        ? " au VOTE du groupe au salon."
        : " au salon pour information — la DÉCISION FINALE appartient au créateur (ne lance pas un vote contraignant).") +
      `\n` +
      `- \`status { status }\` : fais passer la mission de collecting à proposing (collecte suffisante), puis à done (décision actée).\n` +
      "- `nothing {}` : quand rien de neuf ne mérite d'agir. Préfère `nothing` à un message creux."
  );

  if (collab.propositions?.quorum != null && collab.propositions.quorum > 0) {
    blocks.push(
      `QUORUM / SEUIL DE DÉCISION configuré par le créateur : au moins ${collab.propositions.quorum} participant(s). ` +
        "Respecte ce seuil avant de passer en `done` (et avant de clore un vote si le mode est vote)."
    );
  }

  const relances = collab.relances;
  blocks.push(
    `RELANCES : un participant silencieux se relance EN PRIVÉ, avec tact, au plus ${relances?.max ?? 2} fois` +
      ` (délai ≈ ${relances?.delaiHeures ?? 24} h entre deux). Au-delà, tu le signales simplement dans la synthèse.`
  );

  if (input.status === "proposing" && input.espace.webSearch && collab.propositions?.webCheck !== false) {
    blocks.push(
      "La mission est en phase de PROPOSITIONS et la recherche web est active : vérifie les options (prix, disponibilités, trajets) avant de les publier, et marque `verified: true` uniquement pour ce que tu as réellement vérifié."
    );
  } else {
    blocks.push(
      "Ne présente JAMAIS un prix, une disponibilité ou un trajet comme vérifié : marque `verified: false` et dis ce qui reste à confirmer."
    );
  }

  blocks.push(
    `Date et heure actuelles : ${new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "full",
      timeStyle: "short",
    })} (heure de Paris).`
  );

  blocks.push(
    "FORMAT DE SORTIE — obligatoire : un unique bloc HTML `<!--" +
      COLLAB_ACTION_MARKER +
      ': {"actions":[ … ]}-->` en fin de réponse. Aucun texte hors de ce bloc ne sera affiché. ' +
      "Si tu n'as rien à faire : `{\"actions\":[{\"type\":\"nothing\"}]}`."
  );

  const creatorPrompt = input.espace.systemPrompt?.trim();
  blocks.push(
    "INSTRUCTIONS DU CRÉATEUR — ton identité et ton ton, qui priment sur les consignes de style ci-dessus :\n\n" +
      (creatorPrompt || `Tu es le gent « ${gentName} » de Getgents.`)
  );

  return blocks.filter((b) => b.trim()).join("\n\n");
}

/** Le message « utilisateur » : l'état complet de la session, à chaque tick. */
export function buildOrchestratorStateMessage(input: OrchestratorPromptInput): string {
  const { participants, collection, synthesis, messages, questionsById } = {
    ...input,
    questionsById: new Map((input.collab.questions ?? []).map((q) => [q.id, q])),
  };
  const questions = input.collab.questions ?? [];
  const lines: string[] = [];

  lines.push(`STATUT DE LA MISSION : ${input.status}`);
  lines.push(`ORCHESTRATIONS CONSOMMÉES : ${input.orchestrationCount}/${input.maxOrchestrations}`);

  lines.push(`\nPARTICIPANTS (${participants.length}) :`);
  for (const p of participants) {
    const reponses = collection[p.id] ?? {};
    const nb = Object.values(reponses).filter((v) => String(v ?? "").trim() !== "").length;
    const badge = p.role === "organizer" ? " [créateur de la mission]" : "";
    const manquantes = questions
      .filter((q) => String(reponses[q.id] ?? "").trim() === "")
      .map((q) => q.id);
    lines.push(
      `- ${p.name} (${p.id})${badge} — ${questions.length ? `${nb}/${questions.length} réponses` : `${nb} info(s)`}` +
        (manquantes.length ? ` — manque : ${manquantes.join(", ")}` : " — collecte complète")
    );
  }

  lines.push("\nRÉPONSES COLLECTÉES (privé — synthétise, ne cite jamais tel quel au salon) :");
  const entries = Object.entries(collection);
  if (!entries.length) {
    lines.push("(aucune pour l'instant)");
  } else {
    for (const [pid, reponses] of entries) {
      const nom = participants.find((p) => p.id === pid)?.name ?? pid;
      for (const [qid, value] of Object.entries(reponses)) {
        const q = questionsById.get(qid);
        lines.push(`- ${nom} / ${q?.label ?? qid} : ${String(value)}`);
      }
    }
  }

  lines.push("\nSYNTHÈSE ACTUELLE (telle que publiée dans l'onglet Synthèse) :");
  lines.push(Object.keys(synthesis).length ? JSON.stringify(synthesis, null, 1) : "(vide — à initialiser)");

  lines.push("\nMESSAGES RÉCENTS (salon et tes fils privés ; tu ne vois jamais les conversations entre participants) :");
  const recents = messages.slice(-MAX_MESSAGES_IN_PROMPT);
  if (!recents.length) {
    lines.push("(aucun message encore — le salon vient d'ouvrir)");
  }
  for (const m of recents) {
    const heure = fmtHeure(m.createdAt);
    if (m.channel === COLLAB_ROOM_CHANNEL) {
      lines.push(`[salon ${heure}] ${m.author === COLLAB_GENT_AUTHOR ? "TOI" : m.authorName} : ${m.text}`);
    } else {
      // Canal gent:<participantId> : le privé avec cette personne.
      const pid = m.channel.slice("gent:".length);
      const nom = participants.find((p) => p.id === pid)?.name ?? pid;
      const sens = m.author === COLLAB_GENT_AUTHOR ? `TOI → ${nom}` : `${nom} → TOI`;
      lines.push(`[privé ${heure}] ${sens} : ${m.text}`);
    }
  }

  lines.push(
    "\nDécide maintenant de tes actions. Rappel : réponds UNIQUEMENT par le bloc `<!--" +
      COLLAB_ACTION_MARKER +
      ": …-->` ; `nothing` si rien ne justifie d'agir."
  );
  return lines.join("\n");
}

// ── Parsing et validation des actions ────────────────────────────────────

const TEXT_MAX = 2000;
const VALUE_MAX = 500;
const SYNTHESIS_MAX_CHARS = 4000;
/** Clés de premier niveau autorisées dans un patch de synthèse. */
const SYNTHESIS_KEYS = new Set(["decision", "facts", "pending", "timeline", "note"]);
const STATUTS = new Set<CollabSessionStatus>(["collecting", "proposing", "done"]);

function asText(v: unknown, max = TEXT_MAX): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

function parseAsk(raw: unknown): CollabAsk | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const q = asText(o.q, 300);
  if (!q) return null;
  const options = Array.isArray(o.options)
    ? o.options.map((x) => asText(x, 80)).filter((x): x is string => x !== null).slice(0, 4)
    : [];
  if (!options.length) return null;
  return { q, options, ...(o.multi === true ? { multi: true } : {}) };
}

function parseProposalOption(raw: unknown, index: number): CollabProposalOption | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = asText(o.title, 120);
  if (!title) return null;
  return {
    id: asText(o.id, 40) ?? `opt-${index + 1}`,
    title,
    ...(asText(o.where, 120) ? { where: asText(o.where, 120)! } : {}),
    ...(asText(o.price, 60) ? { price: asText(o.price, 60)! } : {}),
    verified: o.verified === true,
  };
}

/** Une action brute décodée, validée et bornée — ou null si irrecevable. */
export function validateOrchestratorAction(
  raw: unknown,
  ctx: OrchestratorParseContext
): OrchestratorAction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  switch (o.type) {
    case "room_message": {
      const text = asText(o.text);
      return text ? { type: "room_message", text } : null;
    }
    case "dm": {
      const participant = typeof o.participant === "string" ? o.participant : "";
      const text = asText(o.text);
      // Un DM vers un id inconnu enverrait un fil à personne : rejeté, pas deviné.
      if (!ctx.participantIds.includes(participant) || !text) return null;
      const questions = Array.isArray(o.questions)
        ? o.questions.map(parseAsk).filter((q): q is CollabAsk => q !== null).slice(0, 3)
        : undefined;
      return { type: "dm", participant, text, ...(questions?.length ? { questions } : {}) };
    }
    case "record": {
      const participant = typeof o.participant === "string" ? o.participant : "";
      const questionId = typeof o.questionId === "string" ? o.questionId : "";
      const value = asText(o.value, VALUE_MAX);
      // Enregistrer une réponse à une question non déclarée polluerait la
      // collecte : seules les questions du cadre sont recevables.
      if (!ctx.participantIds.includes(participant)) return null;
      if (ctx.questionIds.length && !ctx.questionIds.includes(questionId)) return null;
      if (!questionId || !value) return null;
      return { type: "record", participant, questionId, value };
    }
    case "synthesis": {
      if (!o.patch || typeof o.patch !== "object" || Array.isArray(o.patch)) return null;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o.patch as Record<string, unknown>)) {
        if (SYNTHESIS_KEYS.has(k)) patch[k] = v;
      }
      if (!Object.keys(patch).length) return null;
      if (JSON.stringify(patch).length > SYNTHESIS_MAX_CHARS) return null;
      return { type: "synthesis", patch };
    }
    case "propose": {
      const title = asText(o.title, 160);
      const options = Array.isArray(o.options)
        ? o.options
            .map(parseProposalOption)
            .filter((x): x is CollabProposalOption => x !== null)
            .slice(0, 4)
        : [];
      if (!title || options.length < 2) return null;
      return { type: "propose", title, options };
    }
    case "status": {
      const status = o.status as CollabSessionStatus;
      return STATUTS.has(status) ? { type: "status", status } : null;
    }
    case "nothing":
      return { type: "nothing" };
    default:
      return null;
  }
}

/**
 * Décodage complet d'une réponse d'orchestration : extraction du JSON balisé
 * (fait par l'appelant serveur via extractJsonFromHtmlMarker) puis validation
 * de chaque action. Sans bloc valide — ou sans action recevable — c'est un
 * `nothing` : l'orchestrateur se tait plutôt que d'agir mal.
 */
export function parseOrchestratorActions(
  decoded: unknown,
  ctx: OrchestratorParseContext
): OrchestratorAction[] {
  if (!decoded || typeof decoded !== "object") return [{ type: "nothing" }];
  const actions = (decoded as Record<string, unknown>).actions;
  if (!Array.isArray(actions)) return [{ type: "nothing" }];
  const valid = actions
    .map((a) => validateOrchestratorAction(a, ctx))
    .filter((a): a is OrchestratorAction => a !== null)
    .slice(0, 12); // garde-fou : un tick ne déclenche pas une rafale
  return valid.length ? valid : [{ type: "nothing" }];
}

/** Synthèse initiale posée à l'ouverture de la mission. */
export function initialSynthesis(gentName: string, mission: string): Record<string, unknown> {
  return {
    facts: [],
    pending: ["En attente des premiers participants."],
    timeline: [{ at: new Date().toISOString(), text: `Mission ouverte par ${gentName} : ${mission}` }],
  };
}
