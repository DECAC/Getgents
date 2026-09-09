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
  /**
   * Notre travail est fait et la réponse commence à couler. Dans la boucle
   * d'outils, ce n'est PAS l'accusé de réception du fournisseur : le flux est
   * construit par nous, avant même l'appel au modèle.
   */
  enTetes: number | null;
  /**
   * Premier fragment portant du TEXTE pour le visiteur — voir
   * `porteDuContenu`. Surtout pas le premier octet venu : dans la boucle
   * d'outils, ce sont nos propres événements de statut, émis aussitôt.
   * `null` si aucun mot n'est jamais venu.
   */
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

/**
 * Le fragment SSE porte-t-il du TEXTE destiné au visiteur ?
 *
 * Question vitale pour la mesure : dans la boucle d'outils, le serveur émet
 * d'abord ses propres événements — statut « preparing », pings anti-coupure,
 * événements d'outils. Ils partent immédiatement. Horodater le premier
 * fragment venu revenait donc à chronométrer notre propre ping, et
 * `premierJetonMs` retombait exactement sur `preparationMs` — un silence de
 * vingt secondes passait inaperçu.
 *
 * On ne retient donc que le premier fragment portant un `delta.content` non
 * vide : c'est le moment où un mot s'affiche pour de bon.
 *
 * Fonction PURE — elle lit un texte, rien d'autre.
 */
export function porteDuContenu(fragment: string): boolean {
  for (const ligne of fragment.split("\n")) {
    const t = ligne.trim();
    if (!t.startsWith("data:")) continue;
    const charge = t.slice(5).trim();
    if (!charge || charge === "[DONE]") continue;
    let json: unknown;
    try {
      json = JSON.parse(charge);
    } catch {
      // Fragment coupé au milieu d'un objet : le suivant le portera.
      continue;
    }
    const choix = (json as { choices?: { delta?: { content?: unknown } }[] }).choices;
    if (!Array.isArray(choix)) continue;
    for (const c of choix) {
      const contenu = c?.delta?.content;
      if (typeof contenu === "string" && contenu.length > 0) return true;
    }
  }
  return false;
}
