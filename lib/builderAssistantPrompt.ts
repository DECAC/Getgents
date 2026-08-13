import type { GentDraft } from "@/lib/types/builder";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";
import { GENT_CONFIG_PROMPT_INSTRUCTION } from "@/lib/gentConfigSignal";
import {
  CONNECTOR_PROMPT_INSTRUCTION,
  CONNECTOR_DISCOVERY_INSTRUCTION,
  REST_API_MANUAL_INSTRUCTION,
} from "@/lib/connectorSignal";
import { JUMP_FORM_PROMPT_INSTRUCTION } from "@/lib/jumpFormSignal";
import { SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import { APP_PREVIEW_PROMPT_INSTRUCTION } from "@/lib/appPreview";

const MODEL_CAPABILITY_LABEL: Record<string, string> = {
  chat: "Conversation",
  reasoning: "Raisonnement approfondi",
  image: "Génération d'image",
  tts: "Synthèse vocale",
  stt: "Transcription vocale",
};

const MODEL_CATALOG_SUMMARY = MODEL_CATALOG.map(
  (m) =>
    `- id="${m.id}" [${MODEL_CAPABILITY_LABEL[m.capability] ?? m.capability}] ${m.label} (${m.provider}) — ${m.tagline} (env. $${m.pricing.input}/$${m.pricing.output} par 1M tokens en entrée/sortie)`
).join("\n");

export const MODEL_RECOMMENDATION_INSTRUCTION =
  `Voici le catalogue des modèles disponibles pour ce gent (une seule clé API OpenRouter donne accès à tous) :\n${MODEL_CATALOG_SUMMARY}\n\n` +
  "L'assistant du builder utilise toujours Kimi K3 (Moonshot AI) pour vous guider — le modèle « chat » ci-dessous concerne le gent une fois publié. " +
  "Dès que l'objectif ou les instructions données par le créateur laissent deviner un besoin particulier (raisonnement complexe, génération d'image, restitution vocale, budget serré, gros volume de texte...), recommande explicitement, capacité par capacité, le ou les modèles les plus adaptés parmi cette liste, en une phrase de justification, et propose leur assignation via le bloc GENT_CONFIG en recopiant EXACTEMENT les id=\"…\" du catalogue (ex. chatModelId=\"anthropic/claude-sonnet-5\", reasoningModelId=\"deepseek/deepseek-r1\") — jamais le seul libellé.";

/**
 * Rôle de l'assistant du builder — placé en tête du message système.
 * Sans cette frontière, une phrase d'objectif (« analyse DPE… ») est prise
 * pour une question métier et le modèle répond comme le gent fini.
 */
export const BUILDER_ROLE_INSTRUCTION =
  "Tu es l'ASSISTANT DU BUILDER Getgents : tu aides le CRÉATEUR à concevoir et configurer un gent (prompt système, modèles, connecteurs, recherche web, formulaires…). " +
  "Tu n'ES PAS le gent publié, ni un expert métier qui répond à l'utilisateur final. " +
  "Quand le créateur décrit un objectif, un rôle ou un cas d'usage (même en une phrase courte qui ressemble à une mission métier, ex. « analyse DPE de maisons à vendre »), " +
  "traite-le comme la MISSION DU GENT À CONSTRUIRE : propose immédiatement un prompt système, des modèles et des connecteurs adaptés via le bloc GENT_CONFIG. " +
  "N'écris JAMAIS un long guide / tutoriel / analyse comme si tu exécutais déjà cette mission pour un client. " +
  "La recherche web sert à découvrir des connecteurs ou à documenter la config — pas à produire une réponse d'expert à la place du gent.";

/**
 * Verrou de fin : le modèle lit la queue du message système comme faisant
 * autorité (même principe que pour le prompt du créateur à l'exécution).
 */
export const BUILDER_ROLE_CLOSING =
  "RAPPEL FINAL (prioritaire) : tu configures le gent avec le créateur. " +
  "Une description d'objectif n'est pas une question à laquelle répondre en expert. " +
  "Réponds en designer de gent : résumé court de la config proposée + bloc GENT_CONFIG. " +
  "Interdit : dissertations métier, checklists destinées à l'acheteur/utilisateur final, réponses « voici comment analyser… ».";

/** Message API quand le créateur vient de poser l'objectif (accueil studio ou 1er tour). */
export function frameBuilderObjectiveMessage(objective: string): string {
  const clean = objective.trim();
  return (
    `Objectif du gent à construire (défini par le créateur) : « ${clean} ».\n\n` +
    "Configure ce gent maintenant : rédige un prompt système adapté, choisis modèles et connecteurs pertinents, " +
    "et émets le bloc GENT_CONFIG. Ne réponds pas comme l'expert métier de cet objectif."
  );
}

/**
 * Premier tour utile après le message de bienvenue : le créateur pose l'objectif
 * et le prompt système du gent est encore vide.
 */
export function isBuilderObjectiveSeedTurn(
  draft: Pick<GentDraft, "systemPrompt" | "builderConversation">
): boolean {
  if ((draft.systemPrompt ?? "").trim()) return false;
  const priorUserTurns = draft.builderConversation.filter((m) => m.role === "user").length;
  return priorUserTurns === 0;
}

/** Message visible (et envoyé à l'assistant) quand un fichier devient une connaissance. */
export function frameBuilderKnowledgeFileMessage(
  name: string,
  chars: number,
  truncated: boolean,
  extra?: string
): string {
  const size = chars.toLocaleString("fr-FR");
  const trunc = truncated ? ", extrait tronqué" : "";
  const head =
    `J'ai ajouté le fichier « ${name} » aux connaissances du gent (${size} caractères${trunc}). ` +
    "Il servira de base de connaissance à l'usage — ne le recopie pas dans tes réponses.";
  const note = extra?.trim();
  return note ? `${head} ${note}` : `${head} Configure le gent pour s'en servir si besoin.`;
}

type BuilderPromptDraft = Pick<
  GentDraft,
  "name" | "objective" | "systemPrompt" | "connectors" | "appPreview" | "knowledgeSources"
>;

/**
 * État de l'aperçu déjà affiché au créateur : sans ce rappel, l'assistant
 * ré-inventerait des identifiants à chaque tour et empilerait des doublons au
 * lieu de faire évoluer les modules existants.
 */
function knowledgeNote(draft: BuilderPromptDraft): string {
  const sources = draft.knowledgeSources ?? [];
  if (!sources.length) return "";
  const list = sources
    .map((s) => {
      const read = s.text?.trim() ? "contenu lu, disponible pour le gent publié" : "nom seul";
      return `« ${s.label} » (${s.kind}, ${read})`;
    })
    .join(" ; ");
  return (
    `\n\nBase de connaissance du gent : ${list}. ` +
    "Ces fichiers appartiennent au gent publié — ne les recopie pas dans tes réponses. " +
    "Tu peux seulement confirmer qu'ils sont en place et adapter le prompt système pour que le gent s'en serve."
  );
}

function appPreviewNote(draft: BuilderPromptDraft): string {
  const preview = draft.appPreview;
  if (!preview?.modules.length) return "\n\nAucun aperçu d'application n'a encore été proposé au créateur.";
  const modules = preview.modules
    .map((m) => `id="${m.id}" (onglet « ${m.theme} », ${m.size}) : ${m.title}`)
    .join(" ; ");
  return (
    `\n\nAperçu d'application actuellement affiché — onglets : ${preview.themes.join(", ")}. ` +
    `Modules : ${modules}. Reprends ces identifiants pour modifier un module existant.`
  );
}

/** Assemble le message système envoyé à l'assistant du builder. */
export function buildBuilderSystemPrompt(draft: BuilderPromptDraft): string {
  const connectorsNote = draft.connectors.length
    ? `\n\nConnecteurs déjà configurés : ${draft.connectors
        .map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`)
        .join(", ")}.`
    : "";

  const draftContext = draft.systemPrompt
    ? `Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Voici son prompt système actuel :\n\n${draft.systemPrompt}\n\nAide le créateur à améliorer ce prompt et la configuration du gent.`
    : `Le gent en cours s'appelle "${draft.name}". Objectif : ${draft.objective || "non défini"}. Aide le créateur à rédiger un prompt système efficace et à proposer la configuration complète (modèles, connecteurs…).`;

  return [
    BUILDER_ROLE_INSTRUCTION,
    draftContext + connectorsNote + knowledgeNote(draft) + appPreviewNote(draft),
    MODEL_RECOMMENDATION_INSTRUCTION,
    GENT_CONFIG_PROMPT_INSTRUCTION,
    APP_PREVIEW_PROMPT_INSTRUCTION,
    CONNECTOR_PROMPT_INSTRUCTION,
    CONNECTOR_DISCOVERY_INSTRUCTION,
    REST_API_MANUAL_INSTRUCTION,
    JUMP_FORM_PROMPT_INSTRUCTION,
    SUGGESTIONS_PROMPT_INSTRUCTION,
    BUILDER_ROLE_CLOSING,
  ].join("\n\n");
}
