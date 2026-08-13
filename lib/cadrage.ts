import type { GentDraft } from "@/lib/types/builder";
import type { BuilderTurnProfile } from "@/lib/builderAssistantPrompt";
import { buildBuilderSystemPrompt } from "@/lib/builderAssistantPrompt";
import { isTrustAnswer } from "@/lib/suggestions";

/**
 * « Tour de cadrage » : avant toute génération structurante, l'assistant pose
 * UNE question cliquable au créateur au lieu d'inventer à sa place.
 *
 * Le mécanisme existait déjà, mais uniquement pour faire ÉVOLUER un aperçu
 * (mode « apercu-ask ») : à la première génération, l'assistant choisissait
 * seul les onglets de l'application. Ce module généralise le motif à tous les
 * moments structurants, avec une porte de sortie (« Fais-moi confiance »).
 *
 * Aucun nouveau marqueur n'est introduit : le tour de question réutilise le
 * bloc <!--QUESTIONS: …--> déjà en place, et les réponses reviennent en texte
 * brut tel que sérialisé par QuickReplyQuestions. La cascade d'extraction de
 * BuilderContext reste donc inchangée.
 */
export type CadrageAction = "apercu" | "apercu-evolve" | "prompt" | "jump-form" | "connectors";

export interface CadrageSpec {
  action: CadrageAction;
  /** Libellé humain, pour les traces et l'interface. */
  label: string;
  /** Profil de prompt système du tour de QUESTION (allégé). */
  profile: BuilderTurnProfile;
  /** Sujet imposé à la question posée au créateur. */
  askInstruction: string;
  /** Consigne d'application, une fois la réponse obtenue. */
  applyInstruction: string;
}

export const CADRAGE_ACTIONS: Record<CadrageAction, CadrageSpec> = {
  apercu: {
    action: "apercu",
    label: "Aperçu de l'application",
    profile: "cadrage",
    askInstruction:
      "Demande au créateur quels ONGLETS (grands axes) il veut voir dans l'application de son gent. " +
      "Propose 3 découpages plausibles déduits de l'objectif du gent, formulés en une ligne chacun " +
      "(ex. « Suivi / Analyse / Actions »). Une seule question.",
    applyInstruction:
      "Génère maintenant l'aperçu en respectant ce découpage : émets le bloc APERCU en premier, sans GENT_CONFIG ni recherche.",
  },
  "apercu-evolve": {
    action: "apercu-evolve",
    label: "Évolution de l'aperçu",
    profile: "cadrage",
    askInstruction:
      "Demande au créateur quelle évolution il veut pour l'aperçu déjà affiché. " +
      "Propose 3 pistes concrètes portant sur les modules existants. Une seule question.",
    applyInstruction:
      "Applique cette évolution maintenant : émets le bloc APERCU en premier (un ou deux modules concernés), sans GENT_CONFIG ni recherche.",
  },
  prompt: {
    action: "prompt",
    label: "Instructions du gent",
    profile: "cadrage",
    askInstruction:
      "Demande au créateur quel TON et quel périmètre il veut pour son gent avant que tu ne rédiges ses instructions. " +
      "Propose 3 postures plausibles (ex. « expert factuel », « pédagogue », « concis et opérationnel »). Une seule question.",
    applyInstruction:
      "Rédige maintenant le prompt système en respectant cette orientation, et émets le bloc GENT_CONFIG.",
  },
  "jump-form": {
    action: "jump-form",
    label: "Formulaire de lancement",
    profile: "cadrage",
    askInstruction:
      "Demande au créateur quelles INFORMATIONS son utilisateur devra fournir au lancement. " +
      "Propose 3 jeux de champs plausibles pour cet objectif. Une seule question, multi:true.",
    applyInstruction: "Compose maintenant le formulaire correspondant et émets le bloc JUMP_FORM.",
  },
  connectors: {
    action: "connectors",
    label: "Connecteurs",
    profile: "cadrage",
    askInstruction:
      "Demande au créateur à quelles SOURCES DE DONNÉES son gent doit accéder. " +
      "Propose 3 familles plausibles pour cet objectif. Une seule question, multi:true.",
    applyInstruction: "Propose maintenant les connecteurs correspondants.",
  },
};

/** Génération mise en attente pendant que le créateur répond à la question. */
export interface CadragePending {
  action: CadrageAction;
  /** Requête de génération d'origine, rejouée une fois la réponse obtenue. */
  request: string;
}

/**
 * Prompt système du tour de question.
 *
 * Il part du profil allégé (voir buildBuilderSystemPrompt) et y ajoute une
 * interdiction explicite d'émettre le moindre marqueur de génération : ce tour
 * ne doit produire qu'un bloc QUESTIONS. Sans ce verrou, le modèle répond
 * volontiers à la question ET génère dans la foulée, ce qui vide le cadrage de
 * son sens — et ferait apparaître une carte « Appliquer » avant même que le
 * créateur ait choisi.
 */
export function buildCadrageSystemPrompt(
  draft: Parameters<typeof buildBuilderSystemPrompt>[0],
  action: CadrageAction
): string {
  const spec = CADRAGE_ACTIONS[action];
  return [
    buildBuilderSystemPrompt(draft, spec.profile),
    "TOUR DE CADRAGE — tu ne produis RIEN d'autre qu'une question. " +
      `Sujet imposé : ${spec.askInstruction} ` +
      "N'émets AUCUN bloc APERCU, GENT_CONFIG, CONNECTOR, CONNECTORS ni JUMP_FORM dans cette réponse. " +
      "Une phrase courte pour poser la question, puis le bloc QUESTIONS — rien de plus. " +
      "N'inclus ni « Autre » ni « Fais-moi confiance » dans les options : l'interface les ajoute.",
  ].join("\n\n");
}

/** Message envoyé au modèle pour qu'il pose sa question. */
export function buildCadrageAskMessage(action: CadrageAction): string {
  return CADRAGE_ACTIONS[action].askInstruction;
}

/**
 * Requête de génération enrichie des préférences du créateur.
 *
 * Les réponses arrivent au format sérialisé par QuickReplyQuestions
 * (« 1. <question> → <valeurs> ») : on les transmet telles quelles, sans
 * nouveau format d'échange.
 */
export function buildCadrageFollowUpMessage(pending: CadragePending, answers: string): string {
  const spec = CADRAGE_ACTIONS[pending.action];
  const trimmed = answers.trim();

  if (!trimmed || isTrustAnswer(trimmed)) {
    // Le créateur s'en remet à l'assistant : on ne lui impose aucune
    // préférence, mais on lui rappelle qu'il décide seul.
    return `${pending.request}\n\nLe créateur te laisse trancher : choisis le découpage le plus pertinent pour son objectif. ${spec.applyInstruction}`;
  }

  return `${pending.request}\n\nPréférences du créateur (à respecter) :\n${trimmed}\n\n${spec.applyInstruction}`;
}

/**
 * Le cadrage est-il court-circuité ?
 *
 * `autoPilot` est le mode « fais-moi confiance » persistant : le créateur ne
 * veut plus être consulté pour ce gent. On économise alors un aller-retour
 * réseau et le tour de question.
 */
export function shouldSkipCadrage(draft: Pick<GentDraft, "autoPilot">): boolean {
  return !!draft.autoPilot;
}
