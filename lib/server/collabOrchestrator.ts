import { extractJsonFromHtmlMarker } from "@/lib/server/markerJson";
import { resolveCollabLink } from "@/lib/server/collabContext";
import {
  collabOrchestrationBegin,
  collabOrchestrationEnd,
  getCollabSession,
  insertCollabMessage,
  listCollabParticipants,
  listRecentCollabMessages,
  patchCollabSynthesis,
  updateCollabSessionStatus,
  writeCollabCollection,
} from "@/lib/server/collab";
import { chatResponseFor } from "@/lib/server/chatEngine";
import { contexteForGent } from "@/lib/server/openRouterKey";
import { consommerPourVisiteur } from "@/lib/server/gentGuard";
import {
  COLLAB_ACTION_MARKER,
  buildOrchestratorStateMessage,
  buildOrchestratorSystemPrompt,
  parseOrchestratorActions,
  type OrchestratorAction,
} from "@/lib/collabOrchestrator";
import {
  COLLAB_GENT_AUTHOR,
  COLLAB_ROOM_CHANNEL,
  gentChannel,
  messagesForGent,
} from "@/lib/collab";

/**
 * Le chef d'orchestre du gent collaboratif.
 *
 * Un tick après chaque événement qui le concerne (arrivée d'un participant,
 * message au salon, réponse en fil privé) — JAMAIS après un message entre
 * participants, qu'il ne doit même pas savoir exister. Le tick recharge TOUT
 * l'état (session, participants, messages récents) plutôt que de raisonner
 * sur le seul événement déclencheur : avec un mutex qui interdit les ticks
 * concurrents, le tick en cours voit toujours les derniers messages, et un
 * tick manqué est rattrapé par le suivant.
 *
 * Garde-fous :
 * - plafond `max_orchestrations` par session (chaque tick est un appel LLM
 *   facturé au PROPRIÉTAIRE du gent — voir lib/server/openRouterKey.ts) ;
 * - mutex applicatif (collab_orchestration_begin/end) : pas de double
 *   réponse si deux messages arrivent dans la même seconde ;
 * - la recherche web n'est branchée qu'en phase 'proposing' ;
 * - une panne de l'orchestrateur ne casse JAMAIS la requête de l'utilisateur
 *   (le message, lui, est déjà enregistré) — l'erreur part dans les journaux.
 */

export const COLLAB_ORCHESTRATOR_MAX_TOKENS = 4096;

export async function tickCollabOrchestrator(token: string): Promise<void> {
  const lien = await resolveCollabLink(token);
  if (!lien.ok) return;
  const { link, espace, collab } = lien.value;

  const session = await getCollabSession(link.token);
  if (!session) return;
  if (session.status === "done") return;

  // Mutex + plafond, atomiquement : -1 = un tick est déjà en cours (il verra
  // nos messages) ou le plafond est atteint (le propriétaire est protégé).
  const claim = await collabOrchestrationBegin(session.id, session.maxOrchestrations);
  if (claim < 0) return;

  try {
    const ctx = await contexteForGent(link.gentId);
    if (!ctx.cle) return; // propriétaire sans clé disponible : le gent se tait
    const quota = await consommerPourVisiteur(ctx, "llm");
    if (!quota.ok) return;

    const [participants, tousLesMessages] = await Promise.all([
      listCollabParticipants(session.id),
      listRecentCollabMessages(session.id),
    ]);
    if (!participants.length) return;

    const gentName = espace.gent || espace.name;
    const promptInput = {
      gentName,
      espace: { name: espace.name, systemPrompt: espace.systemPrompt, webSearch: espace.webSearch },
      collab,
      status: session.status,
      participants,
      collection: session.collection,
      synthesis: session.synthesis,
      // LA règle de confidentialité, appliquée ici : le contexte du gent ne
      // contient jamais un canal peer, quoi que le modèle en fasse ensuite.
      messages: messagesForGent(tousLesMessages),
      orchestrationCount: session.orchestrationCount,
      maxOrchestrations: session.maxOrchestrations,
    };

    const model = espace.chatModelId ?? "anthropic/claude-sonnet-5";
    const upstream = await chatResponseFor(
      {
        model,
        messages: [
          { role: "system", content: buildOrchestratorSystemPrompt(promptInput) },
          { role: "user", content: buildOrchestratorStateMessage(promptInput) },
        ],
        stream: false,
        max_tokens: COLLAB_ORCHESTRATOR_MAX_TOKENS,
        // La vérification web des options n'a de sens qu'en phase de
        // propositions — en collecte, elle facturerait des recherches
        // prématurées à chaque message du salon.
        webSearch: session.status === "proposing" && collab.propositions?.webCheck !== false
          ? espace.webSearch
          : false,
      },
      ctx,
      "collab-orchestrator"
    );

    const data = (await upstream.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const raw = data?.choices?.[0]?.message?.content ?? "";
    if (!raw) return;

    const decoded = extractJsonFromHtmlMarker(raw, COLLAB_ACTION_MARKER);
    if (!decoded) return;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(decoded);
    } catch {
      return;
    }

    const actions = parseOrchestratorActions(parsedJson, {
      participantIds: participants.map((p) => p.id),
      questionIds: (collab.questions ?? []).map((q) => q.id),
    });

    await applyActions({
      sessionId: session.id,
      gentName,
      collection: session.collection,
      actions,
    });
  } catch (e) {
    // Le salon ne doit jamais tomber parce que son orchestrateur a failli.
    console.error(
      JSON.stringify({
        tag: "getgents:collab",
        event: "orchestrator_failed",
        detail: (e as Error).message,
      })
    );
  } finally {
    await collabOrchestrationEnd(session.id);
  }
}

/** Écrit les actions validées en base, dans l'ordre décidé par le modèle. */
async function applyActions(input: {
  sessionId: string;
  gentName: string;
  collection: Record<string, Record<string, unknown>>;
  actions: OrchestratorAction[];
}): Promise<void> {
  // record et synthesis sont accumulés puis écrits UNE fois : plusieurs
  // réponses apprises au même tick ne déclenchent pas plusieurs updates.
  let collection = input.collection;
  let collectionTouched = false;
  let synthesisPatch: Record<string, unknown> = {};

  for (const action of input.actions) {
    switch (action.type) {
      case "nothing":
        break;
      case "room_message":
        await insertCollabMessage({
          sessionId: input.sessionId,
          channel: COLLAB_ROOM_CHANNEL,
          author: COLLAB_GENT_AUTHOR,
          authorName: input.gentName,
          kind: "text",
          text: action.text,
        });
        break;
      case "dm":
        await insertCollabMessage({
          sessionId: input.sessionId,
          channel: gentChannel(action.participant),
          author: COLLAB_GENT_AUTHOR,
          authorName: input.gentName,
          kind: action.questions?.length ? "question" : "text",
          text: action.text,
          payload: action.questions?.length ? { questions: action.questions } : undefined,
        });
        break;
      case "record":
        collection = {
          ...collection,
          [action.participant]: {
            ...(collection[action.participant] ?? {}),
            [action.questionId]: action.value,
          },
        };
        collectionTouched = true;
        break;
      case "synthesis":
        synthesisPatch = { ...synthesisPatch, ...action.patch };
        break;
      case "propose":
        await insertCollabMessage({
          sessionId: input.sessionId,
          channel: COLLAB_ROOM_CHANNEL,
          author: COLLAB_GENT_AUTHOR,
          authorName: input.gentName,
          kind: "proposal",
          text: action.title,
          payload: { title: action.title, options: action.options },
        });
        break;
      case "status":
        await updateCollabSessionStatus(input.sessionId, action.status);
        break;
    }
  }

  if (collectionTouched) await writeCollabCollection(input.sessionId, collection);
  if (Object.keys(synthesisPatch).length) {
    await patchCollabSynthesis(input.sessionId, {
      ...synthesisPatch,
      updatedAt: new Date().toISOString(),
    });
  }
}
