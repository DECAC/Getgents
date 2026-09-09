/**
 * Mesure d'un tour de conversation servi à un visiteur.
 *
 * Même démarche que `lib/collabTiming.ts`, et pour la même raison : on trouve
 * la réponse lente, et il y a au moins quatre causes possibles — le
 * raisonnement du modèle, le modèle lui-même, la taille du prompt système (qui
 * porte toute la base de connaissance), et la recherche web. Elles se
 * corrigent de quatre façons différentes.
 *
 * LA MESURE QUI COMPTE EST `premierJetonMs`, pas la durée totale. La réponse
 * est diffusée en continu : ce que le visiteur vit comme une attente, c'est le
 * silence AVANT le premier mot. Une fois que le texte défile, une réponse
 * longue ne se ressent plus comme lente.
 *
 * Module PUR — aucune horloge, aucune écriture.
 */

export interface InstantsReponse {
  /** Début du traitement de la requête. */
  debut: number;
  /** En-têtes reçues du fournisseur : la requête est partie et acceptée. */
  enTetes: number | null;
  /** Premier octet de contenu reçu. `null` si rien n'est jamais venu. */
  premierJeton: number | null;
  /** Fin du flux. */
  fin: number | null;
}

export interface ContexteReponse {
  gentId: string;
  model: string;
  /** Le raisonnement a-t-il été demandé au fournisseur ? */
  raisonnement: boolean;
  webSearch: boolean;
  /** Taille du prompt système — il porte la base de connaissance entière. */
  systemChars: number;
  /** Nombre de messages d'historique renvoyés. */
  historique: number;
  maxTokens: number;
}

export interface MesureReponse extends ContexteReponse {
  tag: "getgents:chat";
  event: "reponse_visiteur";
  /** Notre travail avant d'appeler le fournisseur : base, prompt, garde. */
  preparationMs: number | null;
  /** Le silence perçu par le visiteur. LA valeur à regarder. */
  premierJetonMs: number | null;
  /** Durée totale, du début à la fin du flux. */
  totalMs: number | null;
}

export function mesurerReponse(i: InstantsReponse, ctx: ContexteReponse): MesureReponse {
  const delta = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : Math.max(0, Math.round(b - a));

  return {
    tag: "getgents:chat",
    event: "reponse_visiteur",
    ...ctx,
    preparationMs: delta(i.debut, i.enTetes),
    // Mesuré depuis le DÉBUT de la requête, pas depuis l'appel au
    // fournisseur : c'est l'attente réelle du visiteur, notre préparation
    // comprise. La distinguer ensuite se fait avec `preparationMs`.
    premierJetonMs: delta(i.debut, i.premierJeton),
    totalMs: delta(i.debut, i.fin),
  };
}
