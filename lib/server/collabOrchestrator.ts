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
import { mesurerTick, type InstantsTick } from "@/lib/collabTiming";
import { maxTokensPourPhase, modelePourPhase } from "@/lib/collabModels";
import { doitEnchainer, doitPasserEnPropositions } from "@/lib/collabPhase";
import { collabProgress } from "@/lib/collab";
import type { CollabQuestion } from "@/lib/types";
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

/** Résultat d'un tick — exposé au client pour diagnostiquer un salon muet. */
export type CollabOrchestratorTickResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_collab"
        | "no_session"
        | "done"
        | "busy_or_capped"
        | "no_key"
        | "quota"
        | "empty_llm"
        | "bad_marker"
        | "failed";
      detail?: string;
    };

export async function tickCollabOrchestrator(
  token: string,
  /** Profondeur d'enchaînement. Voir `doitEnchainer` : bornée à un maillon. */
  profondeur = 0
): Promise<CollabOrchestratorTickResult> {
  const lien = await resolveCollabLink(token);
  if (!lien.ok) return { ok: false, reason: "not_collab" };
  const { link, espace, collab } = lien.value;

  const session = await getCollabSession(link.token);
  if (!session) return { ok: false, reason: "no_session" };
  if (session.status === "done") return { ok: false, reason: "done" };

  // Mutex + plafond, atomiquement : -1 = un tick est déjà en cours (il verra
  // nos messages) ou le plafond est atteint (le propriétaire est protégé).
  const claim = await collabOrchestrationBegin(session.id, session.maxOrchestrations);
  if (claim < 0) return { ok: false, reason: "busy_or_capped" };

  // Mesure du tick. Elle commence APRÈS le mutex : ce qui précède n'est pas un
  // tick, et le compter diluerait le chiffre qu'on cherche. Les instants sont
  // relevés ici et mis en forme par `lib/collabTiming.ts`, qui est pur.
  const instants: InstantsTick = { debut: Date.now(), llmDebut: null, llmFin: null, fin: 0 };
  let actionsDecidees: number | null = null;
  let modeleUtilise = modelePourPhase(session.status, espace.chatModelId);
  let webSearchUtilise = false;
  let systemChars = 0;
  let etatChars = 0;
  let messagesEnvoyes = 0;
  let participantsVus = 0;
  /** Vrai si ce tick fait changer la mission de phase — déclenche l'enchaînement. */
  let phaseAChange = false;

  /** Journalise le tick, quelle qu'en soit l'issue. Voir le `finally`. */
  const journaliser = (issue: string) => {
    instants.fin = Date.now();
    console.log(
      JSON.stringify(
        mesurerTick(instants, {
          sessionId: session.id,
          phase: session.status,
          model: modeleUtilise,
          webSearch: webSearchUtilise,
          systemChars,
          etatChars,
          messages: messagesEnvoyes,
          participants: participantsVus,
          orchestration: claim,
          maxOrchestrations: session.maxOrchestrations,
          issue,
          actions: actionsDecidees,
        })
      )
    );
  };

  let resultat: CollabOrchestratorTickResult;
  try {
    // Le corps du tick vit dans une fonction interne pour une seule raison :
    // il compte une dizaine de sorties anticipées, et on veut journaliser
    // CHACUNE avec sa durée. Les recopier une à une serait la garantie d'en
    // oublier une — et une sortie non mesurée est précisément celle qui
    // cacherait le problème qu'on cherche.
    resultat = await (async (): Promise<CollabOrchestratorTickResult> => {
      const ctx = await contexteForGent(link.gentId);
      if (!ctx.cle) return { ok: false, reason: "no_key" };
      const quota = await consommerPourVisiteur(ctx, "llm");
      if (!quota.ok) return { ok: false, reason: "quota" };

      const [participants, tousLesMessages] = await Promise.all([
        listCollabParticipants(session.id),
        listRecentCollabMessages(session.id),
      ]);
      participantsVus = participants.length;
      if (!participants.length) return { ok: true };

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

      // Le modèle dépend de la PHASE, pas seulement du gent : la collecte est
      // la phase longue et pauvre en décisions, et lui donner le modèle des
      // propositions revenait à payer 15 s pour un « c'est noté ».
      // Voir lib/collabModels.ts pour la mesure qui a motivé ce découpage.
      const model = modelePourPhase(session.status, espace.chatModelId);
      modeleUtilise = model;

      // Les deux messages sont construits AVANT l'appel pour pouvoir mesurer ce
      // qu'on envoie réellement. Seule la longueur part aux journaux : le prompt
      // du créateur et les messages du salon n'y figurent jamais.
      const messageSysteme = buildOrchestratorSystemPrompt(promptInput);
      const messageEtat = buildOrchestratorStateMessage(promptInput);
      systemChars = messageSysteme.length;
      etatChars = messageEtat.length;
      messagesEnvoyes = promptInput.messages.length;

      webSearchUtilise =
        session.status === "proposing" && collab.propositions?.webCheck !== false
          ? !!espace.webSearch
          : false;

      instants.llmDebut = Date.now();
      const upstream = await chatResponseFor(
        {
          model,
          messages: [
            { role: "system", content: messageSysteme },
            { role: "user", content: messageEtat },
          ],
          stream: false,
          max_tokens: maxTokensPourPhase(session.status),
          // La vérification web des options n'a de sens qu'en phase de
          // propositions — en collecte, elle facturerait des recherches
          // prématurées à chaque message du salon.
          webSearch: webSearchUtilise,
        },
        ctx,
        "collab-orchestrator"
      );

      const data = (await upstream.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
      } | null;
      // Le chrono s'arrête ICI, pas au retour de `chatResponseFor` : l'appel est
      // en `stream: false`, le corps n'est donc complet qu'une fois lu. S'arrêter
      // plus tôt attribuerait au « reste » l'essentiel de la génération.
      instants.llmFin = Date.now();
      const raw = data?.choices?.[0]?.message?.content ?? "";
      if (!raw) return { ok: false, reason: "empty_llm" };

      const decoded = extractJsonFromHtmlMarker(raw, COLLAB_ACTION_MARKER);
      if (!decoded) return { ok: false, reason: "bad_marker" };
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(decoded);
      } catch {
        return { ok: false, reason: "bad_marker" };
      }

      const actions = parseOrchestratorActions(parsedJson, {
        participantIds: participants.map((p) => p.id),
        questionIds: (collab.questions ?? []).map((q) => q.id),
      });

      actionsDecidees = actions.length;

      await applyActions({
        sessionId: session.id,
        gentName,
        collection: session.collection,
        actions,
        existingMessages: tousLesMessages,
        collabQuestions: collab.questions ?? [],
      });

      // Fin de collecte : c'est un DÉCOMPTE, pas un jugement — l'application
      // le calcule, au lieu d'attendre du modèle une action `status` qu'il
      // remplace volontiers par une phrase d'intention.
      if (session.status === "collecting") {
        const apres = await listCollabParticipants(session.id);
        const majSession = await getCollabSession(link.token);
        const progression = collabProgress(
          apres,
          majSession?.collection ?? session.collection,
          (collab.questions ?? []).length
        );
        if (doitPasserEnPropositions(session.status, progression)) {
          await updateCollabSessionStatus(session.id, "proposing");
          phaseAChange = true;
        }
      }

      return { ok: true };
    })();
  } catch (e) {
    // Le salon ne doit jamais tomber parce que son orchestrateur a failli.
    console.error(
      JSON.stringify({
        tag: "getgents:collab",
        event: "orchestrator_failed",
        detail: (e as Error).message,
      })
    );
    resultat = { ok: false, reason: "failed", detail: (e as Error).message };
  } finally {
    await collabOrchestrationEnd(session.id);
  }

  journaliser(resultat.ok ? "ok" : resultat.reason);

  // La phase vient de changer : on enchaîne UN tick, tout de suite. Sans lui,
  // la mission passe en propositions puis se tait jusqu'à ce qu'un participant
  // reprenne la parole — c'est le blocage observé, l'orchestrateur annonçant
  // des propositions qui ne venaient jamais.
  if (doitEnchainer(phaseAChange, profondeur)) {
    return tickCollabOrchestrator(token, profondeur + 1);
  }

  return resultat;
}

/** Écrit les actions validées en base, dans l'ordre décidé par le modèle. */
async function applyActions(input: {
  sessionId: string;
  gentName: string;
  collection: Record<string, Record<string, unknown>>;
  actions: OrchestratorAction[];
  /** Messages récents déjà en base : sert à dédupliquer les "welcome" doublons. */
  existingMessages: Awaited<ReturnType<typeof listRecentCollabMessages>>;
  /** Pour enrichir des questions sans options (ex. kind "dates"). */
  collabQuestions: CollabQuestion[];
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
        // Déduplication tolérante : compare les textes normalisés (espaces,
        // casse, ponctuation) pour éviter les doublons "Bonjour Romain !" vs
        // "Bonjour Romain." quand plusieurs ticks se succèdent rapidement.
        const normRoom = action.text.trim().toLowerCase().replace(/\s+/g, " ");
        if (
          input.existingMessages.some(
            (m) =>
              m.channel === COLLAB_ROOM_CHANNEL &&
              m.author === COLLAB_GENT_AUTHOR &&
              m.kind === "text" &&
              m.text.trim().toLowerCase().replace(/\s+/g, " ") === normRoom
          )
        ) {
          break;
        }
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
        // Enrichit les questions pour lesquelles le modèle ne fournit
        // pas d'options — on les pioche dans la config du cadre et on
        // ajoute "Autre (préciser)" pour laisser le choix du texte libre.
        const enrichedQuestions = (() => {
          if (!action.questions?.length) {
            // Pas de questions du tout : on tente de trouver une correspondance
            // dans les questions configurées et on en génère une avec options.
            const match = input.collabQuestions.find((q) =>
              action.text.toLowerCase().includes(q.label.toLowerCase().slice(0, 30))
            );
            if (match && match.options?.length) {
              return [{
                q: action.text,
                options: [...match.options.slice(0, 3), "Autre (préciser)"],
              }];
            }
            return undefined;
          }
          return action.questions.map((brut) => {
            // Le modèle écrit parfois l'IDENTIFIANT de la question du cadre à
            // la place de son intitulé — observé en production, un fil privé
            // affichant « q_ytdulcnc » au-dessus des pastilles. On le résout
            // ici, avant écriture : une fois le message en base, plus rien ne
            // le réécrira.
            const parId = input.collabQuestions.find((q) => q.id === brut.q.trim());
            const ask = parId ? { ...brut, q: parId.label } : brut;

            if (ask.options && ask.options.length > 1) return ask;
            // Cherche dans les questions du cadre une correspondance par libellé.
            const match = input.collabQuestions.find((q) =>
              q.label.trim().toLowerCase() === ask.q.trim().toLowerCase() ||
              ask.q.trim().toLowerCase().includes(q.label.trim().toLowerCase().slice(0, 20))
            );
            if (match && match.options?.length) {
              return {
                ...ask,
                options: [...match.options.slice(0, 3), "Autre (préciser)"],
              };
            }
            return ask;
          });
        })();

        // Déduplication tolérante sur les DM aussi.
        const normDm = action.text.trim().toLowerCase().replace(/\s+/g, " ");
        if (
          input.existingMessages.some(
            (m) =>
              m.channel === gentChannel(action.participant) &&
              m.author === COLLAB_GENT_AUTHOR &&
              m.kind === (enrichedQuestions?.length ? "question" : "text") &&
              m.text.trim().toLowerCase().replace(/\s+/g, " ") === normDm
          )
        ) {
          break;
        }

        await insertCollabMessage({
          sessionId: input.sessionId,
          channel: gentChannel(action.participant),
          author: COLLAB_GENT_AUTHOR,
          authorName: input.gentName,
          kind: enrichedQuestions?.length ? "question" : "text",
          text: action.text,
          payload: enrichedQuestions?.length ? { questions: enrichedQuestions } : undefined,
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
