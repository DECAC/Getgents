/**
 * Ce que les outils Gmail rendent au modèle. Module PUR (testable sans réseau).
 *
 * Deux défauts vécus sur une newsletter (MyClaw, The Batch) :
 *   - `gmail_get_message` ne lisait que la partie `text/plain`. Une newsletter
 *     est souvent HTML seulement, ou sa partie texte se réduit à « voir dans le
 *     navigateur » : le corps arrivait VIDE, le gent résumait l'aperçu
 *     (`snippet`) et répondait ensuite « je n'ai pas le contenu détaillé ».
 *   - `gmail_search` renvoyait la réponse brute de l'API, soit des
 *     IDENTIFIANTS sans expéditeur ni objet : le gent affirmait avoir trouvé
 *     des newsletters « qui parlent d'IA » sans en avoir lu une ligne.
 */

type Partie = {
  mimeType?: string;
  body?: { data?: string };
  parts?: unknown[];
};

/** En dessous, la partie texte n'est qu'un renvoi (« voir en ligne ») : le HTML prime. */
export const TEXTE_BRUT_SUFFISANT = 400;
export const CORPS_MAX = 10_000;

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function premierePartie(payload: Partie, mime: string): string {
  if (payload.mimeType === mime && payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const p of payload.parts ?? []) {
    const t = premierePartie(p as Partie, mime);
    if (t) return t;
  }
  return "";
}

const ENTITES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  zwnj: "",
};

/** Le TEXTE d'un e-mail HTML : ni styles, ni scripts, ni adresses de suivi. */
export function texteDepuisHtml(html: string): string {
  return html
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr|table|blockquote|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nom: string) => ENTITES[nom.toLowerCase()] ?? m)
    .replace(/[​-‍͏­]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Le corps lisible d'un message : texte brut s'il dit quelque chose, sinon le HTML converti. */
export function corpsDuMessage(payload: Partie | undefined): string {
  if (!payload) return "";
  const brut = premierePartie(payload, "text/plain").trim();
  if (brut.length >= TEXTE_BRUT_SUFFISANT) return brut.slice(0, CORPS_MAX);
  const html = premierePartie(payload, "text/html");
  const depuisHtml = html ? texteDepuisHtml(html) : "";
  return (depuisHtml.length > brut.length ? depuisHtml : brut).slice(0, CORPS_MAX);
}

export interface ResultatRecherche {
  id: string;
  from?: string;
  subject?: string;
  date?: string;
  snippet?: string;
}

/**
 * Réponse de `gmail_search`. Vide, elle dit au modèle d'ÉLARGIR : la consigne
 * du prompt ne suffisait pas (« rien trouvé avec le sujet exact The Batch »,
 * puis une question à l'utilisateur au lieu d'un `from:deeplearning`).
 */
export function reponseRecherche(requete: string | undefined, resultats: ResultatRecherche[]): string {
  if (!resultats.length) {
    return JSON.stringify({
      requete: requete ?? "",
      resultats: [],
      conseil:
        "Aucun message. Avant de conclure ou de questionner l'utilisateur, élargis TOI-MÊME : " +
        "retire subject: et category:, cherche un fragment du nom ou de l'adresse (from:batch, from:deeplearning), " +
        "ou le nom seul sans opérateur, et allonge la période (newer_than:90d).",
    });
  }
  return JSON.stringify({
    requete: requete ?? "",
    resultats,
    suite: "Lis un message avec gmail_get_message(id) avant d'en décrire le contenu.",
  });
}
