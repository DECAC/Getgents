/**
 * Mesure d'un tick de l'orchestrateur du salon.
 *
 * Pourquoi un module à part, et pourquoi maintenant : on trouve le salon lent,
 * et il y a au moins trois causes possibles — le modèle configuré, la taille du
 * prompt qui grossit à chaque message, et la recherche web branchée en phase
 * de propositions. Elles se corrigent de trois façons différentes, et on ne
 * peut pas savoir laquelle agir sans les séparer.
 *
 * La séparation qui décide de tout est `llmMs` contre `autreMs` : si l'appel
 * au modèle est 95 % du temps, changer de modèle ou raccourcir le prompt sert
 * à quelque chose ; si nos propres allers-retours en base pèsent lourd,
 * changer de modèle ne donnerait rien et on aurait optimisé au mauvais
 * endroit.
 *
 * Module PUR — aucune horloge, aucune écriture. On lui donne des instants
 * déjà relevés ; il n'en prend aucun lui-même, ce qui le rend testable.
 */

export interface InstantsTick {
  /** Début du tick, après l'obtention du mutex. */
  debut: number;
  /** Juste avant l'appel au modèle. `null` si on n'y est jamais arrivé. */
  llmDebut: number | null;
  /** Juste après la lecture complète de la réponse du modèle. */
  llmFin: number | null;
  /** Fin du tick, après écriture des actions. */
  fin: number;
}

export interface ContexteTick {
  sessionId: string;
  /** Phase de la mission : collecting, proposing ou done. */
  phase: string;
  /** Modèle réellement demandé — le repli compris. */
  model: string;
  webSearch: boolean;
  /** Taille des deux messages envoyés. Le contenu, lui, ne part jamais aux journaux. */
  systemChars: number;
  etatChars: number;
  /** Nombre de messages du salon donnés au modèle à ce tick. */
  messages: number;
  participants: number;
  /** Combien de ticks cette session a déjà consommés, sur son plafond. */
  orchestration: number;
  maxOrchestrations: number;
  /** Issue du tick : `ok`, ou la raison de l'abandon. */
  issue: string;
  /** Nombre d'actions décidées par le modèle, quand on est allé jusque-là. */
  actions: number | null;
}

export interface MesureTick extends ContexteTick {
  tag: "getgents:collab";
  event: "orchestrator_tick";
  /** Durée totale du tick, mutex obtenu. */
  totalMs: number;
  /** Temps passé chez le modèle. `null` si l'appel n'a pas eu lieu. */
  llmMs: number | null;
  /** Tout le reste : lectures en base, quota, écriture des actions. */
  autreMs: number | null;
  /** Part du modèle dans le total, en pourcentage entier. Le chiffre à lire. */
  llmPart: number | null;
  /** Caractères envoyés au modèle à ce tick — le prompt grossit avec le salon. */
  promptChars: number;
}

export function mesurerTick(instants: InstantsTick, ctx: ContexteTick): MesureTick {
  const totalMs = Math.max(0, Math.round(instants.fin - instants.debut));

  // L'appel peut ne pas avoir eu lieu (pas de clé, quota épuisé, aucun
  // participant), ou avoir été interrompu par une exception avant sa fin. Dans
  // les deux cas on écrit `null` plutôt que zéro : zéro se lirait comme « le
  // modèle a répondu instantanément », ce qui est faux et ferait chercher la
  // lenteur ailleurs.
  const llmMs =
    instants.llmDebut !== null && instants.llmFin !== null
      ? Math.max(0, Math.round(instants.llmFin - instants.llmDebut))
      : null;

  return {
    tag: "getgents:collab",
    event: "orchestrator_tick",
    ...ctx,
    totalMs,
    llmMs,
    autreMs: llmMs === null ? null : Math.max(0, totalMs - llmMs),
    llmPart: llmMs === null || totalMs === 0 ? null : Math.round((llmMs / totalMs) * 100),
    promptChars: ctx.systemChars + ctx.etatChars,
  };
}
