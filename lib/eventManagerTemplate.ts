import type { CollabConfig, CollabQuestion } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";

/** Prompt système par défaut d'un Event Manager (gabarit team building). */
export const EVENT_MANAGER_DEFAULT_PROMPT =
  "Tu es Event Manager, l'orchestrateur d'événements d'équipe de Getgents.\n\n" +
  "Ton : chaleureux, clair, efficace. Tu relances sans culpabiliser.\n\n" +
  "Règles :\n" +
  "- Tu animes le salon commun et tu interroges chacun en privé pour collecter les infos.\n" +
  "- Tu ne révèles jamais le verbatim d'un échange privé au salon : uniquement des synthèses.\n" +
  "- Tu proposes des options réalistes, vérifiées, dans le cadre (budget, lieu, période).\n" +
  "- Tu tiens à jour la synthèse des décisions (date, lieu, horaires, budget).\n" +
  "- Pour les disponibilités, accepte des dates précises OU une période en texte libre (ex. « les mardis à jeudi en octobre »).";

export const TEAM_BUILDING_MISSION =
  "Organiser le team building d'équipe : trouver 3 options réalistes (lieu, activité, budget), " +
  "collecter les disponibilités et préférences de chacun, faire voter le groupe.";

function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

export function teamBuildingQuestions(): CollabQuestion[] {
  return [
    {
      id: newQuestionId(),
      label: "Quelles sont tes disponibilités ?",
      kind: "dates",
      options: ["sam. 3 oct", "sam. 10 oct", "sam. 17 oct", "sam. 24 oct"],
      required: true,
    },
    {
      id: newQuestionId(),
      label: "Préférence d'activité ?",
      kind: "choice",
      options: ["Plein air", "Culturel", "Sportif", "Atelier créatif"],
      required: true,
    },
    {
      id: newQuestionId(),
      label: "Régime alimentaire ou contrainte à prévoir ?",
      kind: "text",
      required: false,
    },
  ];
}

/** Configuration collab du gabarit team building (mode déjà activé). */
export function teamBuildingCollabConfig(): CollabConfig {
  return {
    enabled: true,
    template: "team-building",
    mission: TEAM_BUILDING_MISSION,
    cadre: {
      budget: "150 € / pers",
      lieu: "< 1 h de Paris",
      periode: "octobre 2026",
      taille: "8 participants",
    },
    exclusions: "Pas d'activités aquatiques, rien hors Île-de-France, pas d'alcool obligatoire.",
    propositions: { options: 3, webCheck: true },
    decision: "vote",
    confidentialite: { syntheses: true, verbatim: false },
    roleCreateur: "membre",
    relances: { delaiHeures: 24, max: 2 },
    questions: teamBuildingQuestions(),
  };
}

/**
 * Applique le gabarit Event Manager sur un brouillon vierge.
 * À faire à la CRÉATION (menu Créer), pas seulement à l'ouverture de l'onglet :
 * sinon Preview ouvre l'espace classique tant que le useEffect n'a pas tourné.
 */
export function applyEventManagerTemplate(draft: GentDraft): GentDraft {
  return {
    ...draft,
    name: "Event Manager",
    icon: "🧭",
    systemPrompt: EVENT_MANAGER_DEFAULT_PROMPT,
    webSearch: true,
    collab: teamBuildingCollabConfig(),
  };
}
