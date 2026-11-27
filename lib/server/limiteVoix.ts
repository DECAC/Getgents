/**
 * Plafond des voix du Publiciste : Gemini et Mistral sont payés par la
 * PLATEFORME, hors du quota OpenRouter. 60 extraits par heure et par compte,
 * en mémoire de l'instance (approximatif, voulu : un garde-fou, pas une
 * facturation).
 */
const FENETRE = 3_600_000;
export const VOIX_PAR_HEURE = 60;
const traces = new Map<string, number[]>();

export function voixAutorisee(userId: string, maintenant = Date.now()): boolean {
  const l = (traces.get(userId) ?? []).filter((t) => maintenant - t < FENETRE);
  if (l.length >= VOIX_PAR_HEURE) {
    traces.set(userId, l);
    return false;
  }
  l.push(maintenant);
  traces.set(userId, l);
  return true;
}
