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

type BuilderPromptDraft = Pick<GentDraft, "name" | "objective" | "systemPrompt" | "connectors">;

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
    draftContext + connectorsNote,
    MODEL_RECOMMENDATION_INSTRUCTION,
    GENT_CONFIG_PROMPT_INSTRUCTION,
    CONNECTOR_PROMPT_INSTRUCTION,
    CONNECTOR_DISCOVERY_INSTRUCTION,
    REST_API_MANUAL_INSTRUCTION,
    JUMP_FORM_PROMPT_INSTRUCTION,
    SUGGESTIONS_PROMPT_INSTRUCTION,
    BUILDER_ROLE_CLOSING,
  ].join("\n\n");
}
