/**
 * Plafonds d'usage par compte.
 *
 * Les routes LLM n'avaient aucune borne : un appelant pouvait boucler
 * indéfiniment sur `/api/chat`, `/api/image` ou `/api/video/analyze`, chaque
 * appel étant facturé chez OpenRouter. Ces compteurs bornent le COÛT par
 * compte et par heure.
 *
 * Ce qu'ils ne sont PAS, et il faut le dire clairement : un anti-déni de
 * service. Ils s'appliquent après authentification, ne protègent pas les
 * routes publiques, et deux requêtes simultanées peuvent passer avant le
 * premier enregistrement. Le décompte est atomique côté PostgreSQL, ce qui
 * suffit à empêcher la dérive, pas à lisser une rafale.
 *
 * Module PUR — la fenêtre et les plafonds sont testables sans base.
 */

export type UsageKind = "llm" | "image" | "video";

/**
 * Plafonds horaires. Volontairement larges : ils doivent être invisibles à
 * l'usage normal et ne mordre que sur un emballement. Un créateur qui
 * construit un gent enchaîne facilement quelques dizaines de tours.
 */
export const USAGE_LIMITS: Record<UsageKind, number> = {
  llm: 300,
  image: 40,
  video: 20,
};

export const USAGE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Début de la fenêtre horaire contenant `now`, en ISO. Des fenêtres alignées
 * sur l'heure (plutôt qu'une glissante) permettent au décompte de tenir dans
 * une seule ligne par compte et par heure, sans historique à purger.
 */
export function windowStart(now: Date): string {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function limitFor(kind: UsageKind): number {
  return USAGE_LIMITS[kind];
}

/** Message de refus : il doit dire quand réessayer, pas seulement « non ». */
export function quotaMessage(kind: UsageKind, now: Date): string {
  const prochaine = new Date(windowStart(now));
  prochaine.setUTCHours(prochaine.getUTCHours() + 1);
  const minutes = Math.max(1, Math.ceil((prochaine.getTime() - now.getTime()) / 60_000));
  const quoi =
    kind === "image" ? "générations d'image" : kind === "video" ? "analyses vidéo" : "requêtes";
  return (
    `Plafond horaire atteint (${USAGE_LIMITS[kind]} ${quoi} par heure). ` +
    `Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`
  );
}
