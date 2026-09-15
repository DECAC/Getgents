/**
 * Quel modèle pour quel moment du salon.
 *
 * Mesuré en production avant d'y toucher (tag getgents:collab,
 * event orchestrator_tick) : sur des ticks réels du gent « Footix Manager2 »,
 * l'appel au modèle pesait 82 à 91 % du temps total — 12,6 s et 16,7 s pour
 * des ticks de 15,4 s et 18,3 s. Le prompt, lui, était modeste (9 000 à 9 500
 * caractères) et la recherche web éteinte. Ce n'est donc ni la taille du
 * contexte ni le web : c'est la génération elle-même.
 *
 * D'où ce découpage. Les trois phases d'une mission n'ont pas le même enjeu :
 *
 *   collecting  Accuser réception, ranger une réponse, relancer. C'est la
 *               phase LONGUE en nombre de ticks et la plus pauvre en
 *               décisions — celle que l'on subit.
 *   proposing   Construire les propositions, avec la recherche web. Rare,
 *               décisive, et la seule où la qualité se voit.
 *   done        La synthèse finale. Une fois.
 *
 * Mettre le gros modèle partout, c'est payer la qualité des propositions à
 * chaque « merci, c'est noté ». On garde donc le modèle du gent là où il
 * décide, et un modèle rapide là où il enregistre.
 *
 * SI ÇA TOURNE MAL : le risque est qu'un modèle rapide tienne moins bien le
 * format de sortie (un bloc JSON dans un marqueur HTML). Ça ne casse rien —
 * le tick sort en `bad_marker` et le suivant rattrape — mais ça se verrait
 * dans les journaux. C'est précisément ce que le champ `issue` permet de
 * surveiller. Pour revenir en arrière, il suffit de rendre `MODELE_COLLECTE`
 * égal à `null`.
 *
 * Module PUR — testable.
 */

/**
 * Modèle des ticks de collecte. `null` désactive le découpage et rend au gent
 * son modèle sur toutes les phases.
 */
export const MODELE_COLLECTE: string | null = "google/gemini-2.5-flash";

/** Modèle de repli quand le gent n'en a aucun de configuré. */
export const MODELE_SALON_DEFAUT = "anthropic/claude-sonnet-5";

export function modelePourPhase(phase: string, modeleDuGent: string | null | undefined): string {
  const duGent = modeleDuGent?.trim() || MODELE_SALON_DEFAUT;

  // Hors collecte, le modèle du créateur fait foi, sans discussion : c'est là
  // que se jouent les propositions et la synthèse, et c'est lui qui a choisi.
  if (phase !== "collecting") return duGent;

  return MODELE_COLLECTE ?? duGent;
}

/**
 * Plafond de génération selon la phase.
 *
 * 4096 partout était un chiffre unique posé sans mesure. Un tick de collecte
 * produit trois actions courtes ; une phase de propositions écrit trois
 * options détaillées. Le plafond ne coûte rien tant qu'il n'est pas atteint —
 * on le baisse donc là où le dépasser signalerait plutôt une dérive, et on le
 * laisse entier là où le texte est réellement long.
 */
export function maxTokensPourPhase(phase: string): number {
  return phase === "collecting" ? 2048 : 4096;
}
