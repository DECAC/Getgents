/**
 * Quand cesser d'offrir des outils au modèle, et le forcer à RÉPONDRE.
 *
 * La route de conversation meurt à 300 s (`maxDuration`, plan Vercel Pro).
 * Un gent qui enchaîne les appels (Gmail : lister, lire, relire…) pouvait
 * consommer tout ce temps en outils : la fonction était tuée avant que le
 * modèle n'écrive un mot, et le visiteur voyait les intégrations défiler
 * puis… rien. Passé ce budget, le tour suivant se fait SANS outils : le modèle
 * rédige avec ce qu'il a déjà obtenu, en gardant le temps d'écrire.
 *
 * Module PUR.
 */
export const MAX_TOURS_OUTILS = 6;

/** Temps laissé aux outils ; le reste (≈ 130 s) sert à rédiger la réponse. */
export const BUDGET_OUTILS_MS = 170_000;

export function outilsEncoreAutorises(tour: number, ecouleMs: number): boolean {
  return tour < MAX_TOURS_OUTILS - 1 && ecouleMs < BUDGET_OUTILS_MS;
}
