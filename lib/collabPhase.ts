/**
 * Passage d'une phase de mission à la suivante.
 *
 * Le salon restait bloqué en `collecting` alors que les trois participants
 * avaient répondu. L'orchestrateur avait pourtant écrit, en toutes lettres :
 * « je reviens vers vous rapidement avec des propositions concrètes ». Il ne
 * l'a jamais fait, pour deux raisons qui se cumulaient :
 *
 *   1. le changement de phase reposait UNIQUEMENT sur une action `status`
 *      émise par le modèle. Le modèle a annoncé la suite en prose au lieu
 *      d'émettre l'action — une confusion banale, et rien ne la rattrapait ;
 *   2. même s'il l'avait émise, plus rien ne réveillait l'orchestrateur. Un
 *      tick ne survient qu'à l'arrivée d'un message. La mission changeait de
 *      phase et attendait que quelqu'un parle pour produire les propositions.
 *
 * On ne demande donc plus au modèle une transition que l'application sait
 * calculer : la collecte est finie quand tout le monde a répondu, c'est un
 * fait, pas un jugement. Le modèle garde la main pour passer en `done`, qui
 * dépend d'une décision et non d'un décompte.
 *
 * Module PUR — testable.
 */

export interface ProgressionCollecte {
  /** Participants ayant répondu à toutes les questions. */
  answered: number;
  /** Participants au total. */
  total: number;
}

/**
 * La collecte est-elle terminée ?
 *
 * Exige au moins un participant : un salon vide n'a rien collecté, et
 * `0 === 0` le ferait passer en propositions dès son ouverture, avant même
 * que quiconque arrive.
 */
export function collecteTerminee(p: ProgressionCollecte): boolean {
  return p.total > 0 && p.answered >= p.total;
}

/**
 * Faut-il basculer en phase de propositions à la fin de ce tick ?
 *
 * Uniquement depuis `collecting` : depuis `proposing` il n'y a nulle part où
 * aller, et depuis `done` ce serait une régression — la mission est close.
 */
export function doitPasserEnPropositions(phase: string, p: ProgressionCollecte): boolean {
  return phase === "collecting" && collecteTerminee(p);
}

/**
 * Faut-il enchaîner un second tick immédiatement ?
 *
 * Oui quand la phase vient de changer : c'est le tick suivant qui produira
 * les propositions, et sans enchaînement la mission resterait muette jusqu'à
 * ce qu'un participant reprenne la parole — exactement le blocage observé.
 *
 * `profondeur` borne la chaîne à UN enchaînement. Sans cette borne, un tick
 * qui rechangerait de phase en relancerait un autre, et chaque maillon est un
 * appel au modèle facturé au propriétaire du gent.
 */
export function doitEnchainer(phaseAChange: boolean, profondeur: number): boolean {
  return phaseAChange && profondeur === 0;
}
