/**
 * « Ce qu'a lu le client » — activité d'une page partagée (13/11).
 *
 * Deux flux SÉPARÉS, par décision de l'utilisateur :
 *   - la LECTURE : anonyme par défaut (un simple compte d'ouvertures, par
 *     jour, sans lien ni appareil) ; nominative — dates, durée, profondeur,
 *     appareil, e-mail à l'auteur — seulement si le destinataire l'accepte
 *     dans le widget ;
 *   - les QUESTIONS à l'assistant : toujours enregistrées, toujours SANS nom
 *     ni lien, datées du jour seulement — on ne doit pas pouvoir les
 *     rattacher à une ligne de lecture.
 *
 * Un destinataire qui n'a pas accepté apparaît « n'a pas partagé ses
 * données », qu'il ait ouvert la page ou non : rien ne doit le laisser
 * deviner.
 *
 * Module PUR : validation de ce qu'envoie le navigateur, repérage des
 * questions sans réponse, synthèse de l'onglet Activité.
 */

/** Les données d'activité sont effacées 120 jours après leur création : un lien vit 30 jours, plus les 90 promis après son expiration. */
export const CONSERVATION_JOURS = 120;
/** Le widget n'apparaît qu'après ce temps de lecture, jamais à l'arrivée. */
export const DELAI_WIDGET_MS = 10_000;
/** Le navigateur renvoie sa durée de lecture à ce rythme, tant que l'onglet est visible. */
export const BATTEMENT_MS = 15_000;
/** Au-delà, une visite est tenue pour finie : un onglet oublié ne compte pas des heures. */
export const DUREE_VISITE_MAX_S = 4 * 3600;

/** Le choix du visiteur, par lien et par navigateur. */
export const cleConsentement = (jeton: string) => `getgents:partage:donnees:${jeton.slice(0, 32)}`;
export type Consentement = "partage" | "anonyme";

/**
 * Marqueur que l'assistant place EN TÊTE de sa réponse quand le document ne
 * contient pas l'information : c'est ce que l'auteur doit ajouter à sa page.
 * Le navigateur l'efface à l'affichage.
 */
export const MARQUEUR_HORS_PAGE = "[HORS PAGE]";

export function sansMarqueur(texte: string): { horsPage: boolean; texte: string } {
  const debut = texte.trimStart();
  if (debut.startsWith(MARQUEUR_HORS_PAGE)) return { horsPage: true, texte: debut.slice(MARQUEUR_HORS_PAGE.length).trimStart() };
  // Pendant le flux, le marqueur arrive par morceaux : on n'affiche pas « [HORS ».
  if (debut.length < MARQUEUR_HORS_PAGE.length && MARQUEUR_HORS_PAGE.startsWith(debut) && debut.startsWith("[")) return { horsPage: false, texte: "" };
  return { horsPage: false, texte };
}

/** Le contenu d'une ligne SSE OpenAI (`data: {...choices[0].delta.content}`), ou "" . */
export function contenuLigneSse(ligne: string): string {
  const l = ligne.trim();
  if (!l.startsWith("data:")) return "";
  const json = l.slice(5).trim();
  if (!json || json === "[DONE]") return "";
  try {
    const d = JSON.parse(json) as { choices?: { delta?: { content?: unknown } }[] };
    const c = d.choices?.[0]?.delta?.content;
    return typeof c === "string" ? c : "";
  } catch {
    return "";
  }
}

export type Appareil = "ordinateur" | "telephone";

export function appareilDe(userAgent: string | null): Appareil {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent ?? "") ? "telephone" : "ordinateur";
}

export interface Battement {
  /** Identifiant de la visite, tiré par le navigateur à chaque ouverture (et à chaque changement de choix). */
  visite: string;
  consentement: boolean;
  /** Secondes de lecture cumulées sur cette visite, onglet visible. */
  duree: number;
  /** Jusqu'où le document a été lu, en pour cent (absent si l'artefact ne le dit pas). */
  profondeur: number | null;
}

/** Ce que le navigateur envoie, assaini. Null si inexploitable. */
export function battementValide(corps: unknown): Battement | null {
  const c = (corps && typeof corps === "object" ? corps : {}) as Record<string, unknown>;
  if (typeof c.visite !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(c.visite)) return null;
  const duree = typeof c.duree === "number" && Number.isFinite(c.duree) ? Math.max(0, Math.min(DUREE_VISITE_MAX_S, Math.round(c.duree))) : 0;
  const p = typeof c.profondeur === "number" && Number.isFinite(c.profondeur) ? Math.max(0, Math.min(100, Math.round(c.profondeur))) : null;
  return { visite: c.visite, consentement: c.consentement === true, duree, profondeur: p };
}

/** Jour civil à Paris, AAAA-MM-JJ : la seule date gardée pour une question ou une ouverture anonyme. */
export function jourParis(t: Date = new Date()): string {
  return t.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

// ——— Synthèse de l'onglet Activité ———

export interface LigneLecture {
  /** Null pour une ouverture anonyme. */
  jeton: string | null;
  jour: string;
  debut: string | null;
  duree: number;
  profondeur: number | null;
  appareil: Appareil | null;
  version: number | null;
}

export interface LigneQuestion {
  id?: string;
  jour: string;
  question: string;
  horsPage: boolean | null;
}

export interface VisiteNommee {
  debut: string;
  duree: number;
  appareil: Appareil | null;
}

export interface LecteurActivite {
  jeton: string;
  destinataire: string;
  /** Faux : n'a pas partagé ses données — sans rien dire de plus. */
  partage: boolean;
  ouvertures: number;
  duree: number;
  profondeur: number | null;
  version: number | null;
  derniere: string | null;
  visites: VisiteNommee[];
}

export interface Activite {
  ouvertures: number;
  anonymes: number;
  partages: number;
  destinataires: number;
  /** ISO si connue à l'heure près (lecture partagée), sinon le jour (AAAA-MM-JJ). */
  derniere: string | null;
  lecteurs: LecteurActivite[];
  questions: { jour: string; items: { id?: string; question: string; horsPage: boolean | null }[] }[];
  totalQuestions: number;
  horsPage: number;
}

/**
 * Assemble l'onglet. `destinataires` : les liens de la page. Une lecture
 * nominative dont le lien n'est plus listé (révoqué) compte dans les totaux,
 * pas dans les lignes.
 */
export function syntheseActivite(
  destinataires: { jeton: string; destinataire: string }[],
  lectures: LigneLecture[],
  questions: LigneQuestion[]
): Activite {
  const nommees = lectures.filter((l) => l.jeton);
  const lecteurs: LecteurActivite[] = destinataires.map((d) => {
    const siennes = nommees.filter((l) => l.jeton === d.jeton).sort((a, b) => (b.debut ?? "").localeCompare(a.debut ?? ""));
    if (!siennes.length) return { jeton: d.jeton, destinataire: d.destinataire, partage: false, ouvertures: 0, duree: 0, profondeur: null, version: null, derniere: null, visites: [] };
    const profondeurs = siennes.map((l) => l.profondeur).filter((p): p is number => p !== null);
    return {
      jeton: d.jeton,
      destinataire: d.destinataire,
      partage: true,
      ouvertures: siennes.length,
      duree: siennes.reduce((n, l) => n + l.duree, 0),
      profondeur: profondeurs.length ? Math.max(...profondeurs) : null,
      version: siennes[0].version,
      derniere: siennes[0].debut,
      visites: siennes.map((l) => ({ debut: l.debut ?? l.jour, duree: l.duree, appareil: l.appareil })),
    };
  });
  // Ceux qui ont partagé d'abord, du plus récent au plus ancien ; les autres dans l'ordre d'envoi.
  lecteurs.sort((a, b) => Number(b.partage) - Number(a.partage) || (b.derniere ?? "").localeCompare(a.derniere ?? ""));

  const parJour = new Map<string, { id?: string; question: string; horsPage: boolean | null }[]>();
  for (const q of questions) {
    const l = parJour.get(q.jour) ?? [];
    l.push({ ...(q.id ? { id: q.id } : {}), question: q.question, horsPage: q.horsPage });
    parJour.set(q.jour, l);
  }
  const jours = Array.from(parJour.keys()).sort().reverse();

  const derniereNommee = nommees.map((l) => l.debut).filter((d): d is string => !!d).sort().pop() ?? null;
  const dernierJour = lectures.map((l) => l.jour).sort().pop() ?? null;
  // Une ouverture anonyme plus récente (autre jour) que la dernière nommée : on ne connaît que son jour.
  const derniere = derniereNommee && dernierJour && jourParis(new Date(derniereNommee)) >= dernierJour ? derniereNommee : dernierJour;

  return {
    ouvertures: lectures.length,
    anonymes: lectures.length - nommees.length,
    partages: lecteurs.filter((l) => l.partage).length,
    destinataires: destinataires.length,
    derniere,
    lecteurs,
    questions: jours.map((jour) => ({ jour, items: parJour.get(jour)! })),
    totalQuestions: questions.length,
    horsPage: questions.filter((q) => q.horsPage === true).length,
  };
}

/** « il y a 2 h », « hier », « le 12 nov. » — pour la dernière ouverture. */
export function ilYA(iso: string | null, maintenant = Date.now()): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const auj = jourParis(new Date(maintenant));
    const hier = jourParis(new Date(maintenant - 86_400_000));
    if (iso === auj) return "aujourd'hui";
    if (iso === hier) return "hier";
    return new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  }
  const s = Math.max(0, (maintenant - Date.parse(iso)) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 2 * 86_400) return "hier";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

export function dureeLisible(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** L'e-mail à l'auteur, à la PREMIÈRE ouverture partagée d'un destinataire. */
export function mailPremiereLecture(a: { titre: string; destinataire: string; lienFiche: string }): { objet: string; html: string } {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return {
    objet: `${a.destinataire} a ouvert « ${a.titre} »`.slice(0, 180),
    html:
      `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:560px">` +
      `<p>Bonjour,</p><p><b>${e(a.destinataire)}</b> vient d'ouvrir <b>${e(a.titre)}</b> et a choisi de partager ses données de lecture avec vous.</p>` +
      `<p><a href="${e(a.lienFiche)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#c98a12;color:#fff;text-decoration:none;font-weight:600">Voir l'activité de la page</a></p>` +
      `<p style="font-size:12px;color:#888">Un seul e-mail par destinataire : les ouvertures suivantes restent dans l'onglet Activité.</p></div>`,
  };
}

// ——— Liste des questions dans l'onglet Assistant ———

/** Clé de rapprochement : sans accents, ponctuation, casse ni espaces superflus. */
export function cleQuestionPosee(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface QuestionRegroupee {
  /** La plus récente du groupe : c'est à elle qu'on répond. */
  id?: string;
  /** Tous les identifiants du groupe : une précision rattachée à l'un vaut pour le groupe. */
  ids: string[];
  question: string;
  horsPage: boolean | null;
  occurrences: number;
  jour: string;
}

/**
 * Une question posée plusieurs fois n'apparaît qu'une fois, au jour de sa
 * dernière occurrence, avec son nombre (« ×3 »). Son état est celui de la
 * dernière réponse de l'assistant. Ordre : du jour le plus récent au plus
 * ancien, et dans un jour, les plus posées d'abord (l'heure n'est pas gardée).
 */
export function regrouperQuestions(jours: Activite["questions"]): QuestionRegroupee[] {
  const groupes = new Map<string, QuestionRegroupee>();
  const ordre: string[] = [];
  // Les jours arrivent du plus récent au plus ancien : la première rencontre d'une clé est la plus récente.
  for (const j of jours) {
    for (const q of j.items) {
      const cle = cleQuestionPosee(q.question) || q.question;
      const g = groupes.get(cle);
      if (g) {
        g.occurrences += 1;
        if (q.id) g.ids.push(q.id);
        continue;
      }
      groupes.set(cle, { ...(q.id ? { id: q.id } : {}), ids: q.id ? [q.id] : [], question: q.question, horsPage: q.horsPage, occurrences: 1, jour: j.jour });
      ordre.push(cle);
    }
  }
  // Dans un même jour, l'heure n'est pas gardée : on montre d'abord les plus posées.
  return ordre.map((c) => groupes.get(c)!).sort((a, b) => b.jour.localeCompare(a.jour) || b.occurrences - a.occurrences);
}

/** Questions par page de l'onglet : le reste s'affiche à la demande. */
export const QUESTIONS_PAR_PAGE = 15;
