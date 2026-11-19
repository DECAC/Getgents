/**
 * BOUTON D'ENGAGEMENT d'une page (19/11, maquettes validées) — règles PURES.
 *
 * L'auteur propose UN bouton à ses lecteurs ; le clic lui est transmis avec
 * le nom du LIEN (le destinataire à qui il l'a envoyé), jamais un nom tapé
 * par le lecteur. Le bouton vit dans la barre Getgents, HORS du document
 * isolé : le cadre reste en lecture seule.
 *
 * Intitulé LIBRE mais borné (30 caractères, texte seul, affiché en texte
 * brut) ; les suggestions sont formulées en INTENTION, jamais en signature
 * (« Bon pour accord » a une portée contractuelle discutable — si l'auteur
 * l'écrit, c'est son choix).
 */

export const INTITULE_MAX = 30;
export const MOT_MAX = 500;

export const INTITULES_SUGGERES = ["Je suis intéressé", "Prendre rendez-vous", "Je souhaite donner suite", "Je viens"] as const;

export interface ReglageEngagement {
  actif: boolean;
  intitule: string;
  /** Le lecteur peut laisser un mot (désactivé par défaut). */
  mot: boolean;
}

export const ENGAGEMENT_PAR_DEFAUT: ReglageEngagement = { actif: false, intitule: "Je suis intéressé", mot: false };

/** Mention FIXE sous le bouton : l'auteur ne peut pas la modifier. */
export function mentionReponse(destinataire: string | null): string {
  return destinataire
    ? `Votre réponse sera transmise à l'auteur, avec votre nom (${destinataire}). Rien d'autre n'est envoyé.`
    : "Votre réponse sera transmise à l'auteur, avec votre nom. Rien d'autre n'est envoyé.";
}

/** Texte nettoyé : sans caractères de contrôle, espaces resserrés. */
const propre = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** L'intitulé tel qu'il sera gardé, ou null s'il est vide ou trop long. */
export function intituleValide(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const s = propre(brut);
  return s && s.length <= INTITULE_MAX ? s : null;
}

/** Le mot du lecteur : texte, retours à la ligne gardés, borné ; vide = null. */
export function motValide(brut: unknown): { ok: true; mot: string | null } | { ok: false } {
  if (brut == null || brut === "") return { ok: true, mot: null };
  if (typeof brut !== "string") return { ok: false };
  const s = brut
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (s.length > MOT_MAX) return { ok: false };
  return { ok: true, mot: s || null };
}

export function reglageValide(corps: unknown): ReglageEngagement | null {
  if (!corps || typeof corps !== "object") return null;
  const c = corps as Record<string, unknown>;
  const intitule = intituleValide(c.intitule);
  if (typeof c.actif !== "boolean" || typeof c.mot !== "boolean" || !intitule) return null;
  return { actif: c.actif, intitule, mot: c.mot };
}

export interface ReponseEngagement {
  id: string;
  jeton: string;
  destinataire: string;
  intitule: string;
  mot: string | null;
  version: number;
  createdAt: string;
  vueAt: string | null;
}
