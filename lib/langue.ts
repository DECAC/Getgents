/**
 * Langue de l'interlocuteur, pour que le gent lui réponde dans la sienne.
 *
 * Un gent est écrit par son créateur dans SA langue : son prompt système, ses
 * questions d'amorce, ses documents. Rien ne demandait au modèle d'en sortir,
 * et un prompt système entièrement en français tire naturellement la réponse
 * vers le français — un visiteur hispanophone recevait donc du français, sans
 * que personne l'ait décidé.
 *
 * Ce module ne traduit rien. Il produit la CONSIGNE qui dit au modèle quelle
 * langue employer. C'est un levier sans commune mesure avec la traduction de
 * l'interface : la conversation est le produit, les boutons sont autour.
 *
 * Module PUR — testable.
 */

/** Langues que l'on sait nommer. Le repli couvre tout le reste. */
const NOMS: Record<string, string> = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
  de: "allemand",
  it: "italien",
  pt: "portugais",
  nl: "néerlandais",
  ca: "catalan",
  ar: "arabe",
  zh: "chinois",
  ja: "japonais",
  ru: "russe",
  pl: "polonais",
};

/**
 * Première langue d'un en-tête `Accept-Language`, en code à deux lettres.
 *
 * L'en-tête est une liste pondérée : `fr-CA,fr;q=0.9,en;q=0.8`. On prend la
 * mieux notée, sans se soucier de la région : un Québécois et un Belge veulent
 * tous deux du français, et distinguer les variantes n'apporterait rien à une
 * consigne de langue.
 *
 * `null` si l'en-tête est absent, vide ou illisible — auquel cas l'appelant
 * s'en remet à la langue du MESSAGE, qui est de toute façon le signal le plus
 * fiable.
 */
export function langueDeLEnTete(acceptLanguage: string | null | undefined): string | null {
  if (typeof acceptLanguage !== "string" || !acceptLanguage.trim()) return null;

  const candidats = acceptLanguage
    .split(",")
    .map((morceau) => {
      const [etiquette, ...params] = morceau.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const poids = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        code: etiquette.trim().toLowerCase().split("-")[0],
        poids: Number.isFinite(poids) ? poids : 0,
      };
    })
    // `*` signifie « n'importe laquelle » : ce n'est pas une langue.
    .filter((c) => /^[a-z]{2,3}$/.test(c.code) && c.code !== "*" && c.poids > 0)
    .sort((a, b) => b.poids - a.poids);

  return candidats[0]?.code ?? null;
}

/** Nom lisible d'un code de langue, pour l'écrire dans une consigne. */
export function nomDeLangue(code: string | null | undefined): string | null {
  if (!code) return null;
  return NOMS[code.toLowerCase()] ?? null;
}

/**
 * Consigne de langue insérée dans le prompt système.
 *
 * DEUX RÈGLES, et leur ordre est ce qui compte.
 *
 * La langue du MESSAGE prime toujours. C'est le signal le plus fiable : un
 * francophone dont le système est en anglais — un cas très courant — écrit en
 * français et doit être compris en français. Se fier au navigateur seul le
 * ferait basculer dans une langue qu'il n'a pas choisie.
 *
 * L'en-tête du navigateur ne sert qu'au PREMIER tour, avant tout message, ou
 * lorsque la langue employée est ambiguë (« ok », « merci »).
 *
 * On précise enfin que les CITATIONS de documents restent dans leur langue
 * d'origine : traduire une citation en la présentant comme telle serait la
 * falsifier, et c'est l'erreur que les modèles commettent volontiers quand on
 * leur demande de « tout dire dans la langue de l'utilisateur ».
 */
export function consigneDeLangue(codeNavigateur: string | null | undefined): string {
  const nom = nomDeLangue(codeNavigateur);

  const base =
    "LANGUE — Réponds TOUJOURS dans la langue de ton interlocuteur, quelle que soit " +
    "celle de tes instructions ou de tes documents. La langue de son dernier message " +
    "fait foi. S'il change de langue, tu changes avec lui.";

  const indice = nom
    ? ` Son navigateur est réglé en ${nom} : commence dans cette langue tant qu'il n'a rien écrit, ` +
      "puis suis la sienne dès son premier message."
    : "";

  const citations =
    " Les CITATIONS d'un document restent dans leur langue d'origine — tu peux les " +
    "traduire à côté, jamais les présenter comme si elles avaient été écrites ainsi.";

  return base + indice + citations;
}
