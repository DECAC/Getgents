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
export function mentionReponse(destinataire: string | null, avecChoix = false): string {
  const nom = destinataire ? `avec votre nom (${destinataire})` : "avec votre nom";
  return avecChoix
    ? `Votre réponse sera transmise à l'auteur, ${nom} et les choix cochés ci-dessus. Rien d'autre n'est envoyé.`
    : `Votre réponse sera transmise à l'auteur, ${nom}. Rien d'autre n'est envoyé.`;
}

/**
 * CHOIX DU LECTEUR (19/11, demande de l'éditeur) : au clic, l'amorce du
 * document relève les cases cochées, les boutons radio choisis, les listes,
 * les curseurs, nombres et `<output>` — JAMAIS un champ de saisie libre
 * (texte, e-mail, zone de texte : risque d'emporter une donnée personnelle).
 * Le lecteur VOIT la liste avant d'envoyer et peut retirer chaque ligne.
 * Le document est du code arbitraire : tout ce qu'il renvoie est revalidé ici
 * (texte seul, borné), et affiché en texte brut.
 */
export const CHOIX_MAX = 20;
export const GROUPE_MAX = 60;
export const VALEUR_MAX = 80;

export interface ChoixLecteur {
  /** Ce sur quoi porte le choix : légende, titre de section précédent… peut être vide. */
  groupe: string;
  valeur: string;
  /** Le lecteur a changé la valeur proposée par la page. */
  modifie: boolean;
}

const borne = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Liste revalidée : entrées malformées écartées, doublons fusionnés, 20 au plus. */
export function choixValides(brut: unknown): ChoixLecteur[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const sortie: ChoixLecteur[] = [];
  for (const x of brut) {
    if (!x || typeof x !== "object") continue;
    const c = x as Record<string, unknown>;
    if (typeof c.valeur !== "string") continue;
    const valeur = borne(propre(c.valeur), VALEUR_MAX);
    const groupe = typeof c.groupe === "string" ? borne(propre(c.groupe), GROUPE_MAX) : "";
    if (!valeur) continue;
    const cle = `${groupe}\u0000${valeur}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ groupe, valeur, modifie: c.modifie === true });
    if (sortie.length >= CHOIX_MAX) break;
  }
  return sortie;
}

/** Une ligne lisible : « Le carrelage — Prestige ». */
export const ligneChoix = (c: ChoixLecteur) => (c.groupe ? `${c.groupe} — ${c.valeur}` : c.valeur);

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
  choix: ChoixLecteur[];
  version: number;
  createdAt: string;
  vueAt: string | null;
}
