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
export function reponseRecherche(
  requete: string | undefined,
  resultats: ResultatRecherche[],
  requeteElargie?: string
): string {
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
    ...(requeteElargie
      ? {
          requeteElargie,
          note: "Rien pour la requête exacte : ces résultats viennent de la requête élargie. Vérifie leurs dates et expéditeurs.",
        }
      : {}),
    resultats,
    /*
     * Vécu (01/10) : une recherche sur « Décibels » rend UN message, et le
     * gent demande « est-ce celui-ci ? » au lieu de le lire. Au tour suivant,
     * l'identifiant n'est plus dans l'historique — les résultats d'outils n'y
     * voyagent pas — et le gent recherche l'objet au caractère près, qu'il ne
     * retrouve jamais. La question a donc PERDU le message qu'il tenait.
     *
     * D'où une consigne qui dépend du nombre de résultats : avec un seul, il
     * n'y a rien à demander.
     */
    suite:
      resultats.length === 1
        ? "UN seul message : lis-le MAINTENANT avec gmail_get_message(id), dans ce même tour. " +
          "Ne demande pas confirmation — au tour suivant tu n'auras plus son identifiant et tu ne le retrouveras pas."
        : "Lis le message le plus probable avec gmail_get_message(id) AVANT d'en décrire le contenu, " +
          "dans ce même tour. Si tu dois vraiment faire choisir, lis quand même le plus probable d'abord : " +
          "au tour suivant les identifiants ci-dessus auront disparu de l'historique.",
  });
}

/**
 * La question porte-t-elle sur la BOÎTE MAIL ? Vécu (Gemini 2.5 Flash, gent
 * Gmail) : « Quel est le sujet principal de la newsletter The Batch de cette
 * semaine ? » → « je n'ai pas accès aux newsletters, transférez-la-moi »,
 * outils disponibles et consigne « CHERCHE D'ABORD » sous les yeux. Sur ces
 * questions, le premier tour IMPOSE `gmail_search` : la consigne ne suffisait
 * pas. Le bloc [ESPACE] joint au message (titres des notes gardées) est
 * ignoré — un titre de note ne fait pas une question sur la boîte.
 */
const MOTS_BOITE =
  /\b(e-?mails?|mails?|courriels?|newsletters?|infolettres?|bo[iî]te (?:mail|de r[ée]ception|aux lettres)|inbox|gmail|exp[ée]diteurs?|non lus?|promotions)\b/i;

export function demandePorteSurLaBoite(message: string | null | undefined): boolean {
  const texte = (message ?? "").replace(/\[ESPACE\][\s\S]*?\[\/ESPACE\]/g, " ");
  return MOTS_BOITE.test(texte);
}

/** Opérateurs qui RESTREIGNENT sans rien dire du contenu : retirés en premier. */
const FILTRES = /\b(?:category|in|label|is|has):(?:"[^"]*"|\([^)]*\)|\S+)/gi;
/** Opérateurs de champ : leur valeur devient du texte libre, cherché partout. */
const CHAMPS = /\b(?:from|subject|to|cc):("[^"]*"|\([^)]*\)|\S+)/gi;
const DATES = /\b(?:newer_than|older_than|after|before):\S+/gi;

function net(q: string): string {
  return q.replace(/\s+/g, " ").trim();
}

/**
 * Requêtes de repli pour une recherche VIDE, de la plus proche à la plus
 * large. Le serveur les essaie lui-même : un modèle qui reçoit « aucun
 * résultat » conclut plus souvent qu'il n'élargit (vécu : « aucune newsletter
 * The Batch avec le sujet exact », puis une question à l'utilisateur).
 */
export function requetesElargies(requete: string | undefined): string[] {
  const q = net(requete ?? "");
  if (!q) return [];
  const sansFiltres = net(q.replace(FILTRES, " ").replace(CHAMPS, " $1 "));
  const sansDates = net(sansFiltres.replace(DATES, " "));
  // Les deux premiers barreaux retirent des OPÉRATEURS ; ils ne touchent ni
  // aux guillemets ni à la ponctuation. Mesuré sur un cas réel : une requête
  // `subject:"[TEST] Décibels #7 | L'IA a-t-elle franchi le mur du son ?"`
  // produisait UN repli, la même phrase exacte sans les opérateurs — aussi
  // introuvable que l'originale. D'où les deux barreaux suivants.
  const sansPonctuation = net(sansDates.replace(PONCTUATION, " "));
  const distinctifs = motsDistinctifs(sansPonctuation);
  const sorties: string[] = [];
  for (const r of [sansFiltres, sansDates, sansPonctuation, distinctifs]) {
    if (r && r !== q && !sorties.includes(r)) sorties.push(r);
  }
  return sorties;
}

/**
 * Ponctuation retirée au dernier recours : guillemets, crochets, barres,
 * dièses, points d'interrogation. Gmail joint les mots restants par ET, donc
 * la requête reste précise — elle cesse seulement d'exiger une phrase
 * EXACTE, qu'un objet de newsletter ne redonne jamais au caractère près.
 */
const PONCTUATION = /["'“”«»\[\]()|#?!:;,.\u2013\u2014/\\]+/g;

/** Mots vides : ils n'aident pas à retrouver un message. */
const MOTS_VIDES = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "a", "au", "aux",
  "en", "sur", "pour", "par", "avec", "sans", "dans", "ce", "cet", "cette", "ces",
  "son", "sa", "ses", "mon", "ma", "mes", "elle", "il", "ils", "elles", "test",
]);

/**
 * Le dernier barreau : les deux mots les plus DISTINCTIFS de la requête.
 *
 * Gmail joint les termes par ET : moins de mots, plus de chances. On garde
 * donc les noms propres d'abord (une majuscule au milieu d'une phrase en
 * signale un), puis les mots longs. Sur le cas mesuré, cela donne
 * « Décibels Conseil » — et le message se retrouve, là où la phrase exacte
 * ne rendait rien.
 */
export function motsDistinctifs(texte: string, combien = 2): string {
  const mots = net(texte)
    .split(" ")
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m.toLowerCase()));
  const vus = new Set<string>();
  const uniques = mots.filter((m) => {
    const cle = m.toLowerCase();
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
  const rang = (m: string) => (/^[A-Z\u00C0-\u00DD]/.test(m) ? 0 : 1);
  const classes = uniques
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rang(a.m) - rang(b.m) || b.m.length - a.m.length || a.i - b.i)
    .slice(0, combien)
    // Remis dans l'ordre d'origine : une requête lisible dans les journaux.
    .sort((a, b) => a.i - b.i)
    .map((x) => x.m);
  return classes.join(" ");
}

/** Politesses et accusés de réception : rien à chercher. */
const POLITESSE =
  /^(merci( beaucoup| bien| infiniment)?|ok(ay)?|d'?accord|super|parfait|top|g[ée]nial|cool|tr[èe]s bien|bien re[çc]u|entendu|not[ée]|oui|non|bonjour|salut|hello|au revoir|bonne (journ[ée]e|soir[ée]e))$/i;

export function simplePolitesse(message: string | null | undefined): boolean {
  const texte = (message ?? "")
    .replace(/\[ESPACE\][\s\S]*?\[\/ESPACE\]/g, " ")
    // Lettres (accents compris), chiffres, apostrophe : le reste (ponctuation,
    // émojis) ne change pas le sens d'un « merci ! 👍 ».
    .replace(/[^A-Za-z\u00C0-\u017F0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !texte || POLITESSE.test(texte);
}

/**
 * Faut-il IMPOSER `gmail_search` au premier tour ?
 *
 * Sur un gent dont Gmail est le SEUL outil, oui, à toute question : c'est
 * son métier. Les mots-clés ne suffisaient pas — vécu (26/09, Gemini 2.5
 * Flash) : « Résume-moi les deux VERBATIM de Dialange », aucun mot de la
 * liste, pas d'outil appelé, et la réponse « je n'ai pas trouvé d'e-mails de
 * Dialange » : une recherche INVENTÉE. Seules les politesses y échappent.
 * Un gent qui a d'autres outils garde le filtre par mots-clés : forcer la
 * boîte mail sur une question météo ou de transport serait absurde.
 */
export function doitImposerRechercheMail(message: string | null | undefined, gmailSeulOutil: boolean): boolean {
  if (simplePolitesse(message)) return false;
  return gmailSeulOutil || demandePorteSurLaBoite(message);
}
