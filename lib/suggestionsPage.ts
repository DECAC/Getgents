/**
 * Questions suggérées aux visiteurs d'une page (levier 3, 13/11).
 *
 * Les bulles de l'assistant (« Résume ce document »…) peuvent être
 * remplacées par de VRAIES questions de visiteurs — toujours après accord et
 * relecture de l'auteur : une question peut porter un détail propre à un
 * client (« chez Acme »), qui fuirait chez tous les autres destinataires.
 * Rien n'est publié automatiquement.
 *
 * Les propositions se calculent SANS modèle : questions identiques à la
 * ponctuation, aux accents et aux majuscules près, posées au moins deux
 * fois, et auxquelles l'assistant a su répondre (sinon la bulle mènerait le
 * visiteur droit vers « la page ne le dit pas »).
 *
 * Module PUR.
 */

export const SUGGESTIONS_MAX = 4;
export const SUGGESTION_MAX = 200;
/** Une question doit revenir au moins ce nombre de fois pour être proposée. */
export const OCCURRENCES_MIN = 2;

export type OrigineSuggestion = "defaut" | "question" | "libre";

export interface Suggestion {
  texte: string;
  origine: OrigineSuggestion;
  /** Question d'origine (origine « question ») : sert à marquer « ★ Suggérée » et « reformulée ». */
  questionId?: string;
}

/** Clé de comparaison : sans accents, ponctuation, casse ni espaces superflus. */
export function cleQuestion(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Les suggestions par défaut, tant que l'auteur n'a rien choisi. */
export function suggestionsParDefaut(amorces: string[]): Suggestion[] {
  return amorces.slice(0, SUGGESTIONS_MAX).map((texte) => ({ texte, origine: "defaut" as const }));
}

/** Ce que l'auteur envoie, assaini. Null si inexploitable. */
export function suggestionsValides(corps: unknown): Suggestion[] | null {
  const liste = (corps && typeof corps === "object" ? (corps as { suggestions?: unknown }).suggestions : null) as unknown;
  if (!Array.isArray(liste) || liste.length > SUGGESTIONS_MAX) return null;
  const vues = new Set<string>();
  const propres: Suggestion[] = [];
  for (const s of liste) {
    if (!s || typeof s !== "object") return null;
    const x = s as Record<string, unknown>;
    const texte = typeof x.texte === "string" ? x.texte.trim().replace(/\s+/g, " ") : "";
    if (!texte || texte.length > SUGGESTION_MAX) return null;
    const origine: OrigineSuggestion = x.origine === "defaut" || x.origine === "question" ? x.origine : "libre";
    const cle = cleQuestion(texte);
    if (vues.has(cle)) continue;
    vues.add(cle);
    const questionId = origine === "question" && typeof x.questionId === "string" && /^[0-9a-f-]{36}$/i.test(x.questionId) ? x.questionId : undefined;
    propres.push({ texte, origine, ...(questionId ? { questionId } : {}) });
  }
  return propres;
}

export interface QuestionPosee {
  id?: string;
  question: string;
  /** Vrai si l'assistant a pu répondre (page, ou précision de l'auteur). */
  repondue: boolean;
}

export interface Proposition {
  texte: string;
  occurrences: number;
  /** Formulations distinctes regroupées sous la même clé. */
  formulations: number;
  questionId?: string;
}

/**
 * Les propositions : questions répondues, posées au moins deux fois, pas déjà
 * suggérées, de la plus fréquente à la moins fréquente. Le texte proposé est
 * la formulation la plus courante (à relire par l'auteur).
 */
/**
 * Clés déjà couvertes par une suggestion : son texte, ET la question dont elle
 * est tirée — reformulée (« Quel est le montant total ? »), elle couvre
 * toujours « Quel est le total ? » et ses variantes.
 */
export function clesSuggerees(suggestions: Suggestion[], questions: { id?: string; question: string }[]): Set<string> {
  const ids = new Set(suggestions.map((s) => s.questionId).filter(Boolean));
  const cles = new Set(suggestions.map((s) => cleQuestion(s.texte)));
  for (const q of questions) if (q.id && ids.has(q.id)) cles.add(cleQuestion(q.question));
  return cles;
}

export function propositions(questions: QuestionPosee[], deja: Suggestion[], max = 5): Proposition[] {
  const exclues = clesSuggerees(deja, questions);
  const groupes = new Map<string, Map<string, { n: number; id?: string }>>();
  for (const q of questions) {
    if (!q.repondue) continue;
    const cle = cleQuestion(q.question);
    if (!cle || exclues.has(cle)) continue;
    const g = groupes.get(cle) ?? new Map<string, { n: number; id?: string }>();
    const texte = q.question.trim();
    const f = g.get(texte) ?? { n: 0, id: q.id };
    f.n += 1;
    g.set(texte, f);
    groupes.set(cle, g);
  }
  const res: Proposition[] = [];
  groupes.forEach((g) => {
    const formes = Array.from(g.entries()).sort((a, b) => b[1].n - a[1].n);
    const total = formes.reduce((n, [, f]) => n + f.n, 0);
    if (total < OCCURRENCES_MIN) return;
    res.push({ texte: formes[0][0].slice(0, SUGGESTION_MAX), occurrences: total, formulations: formes.length, ...(formes[0][1].id ? { questionId: formes[0][1].id } : {}) });
  });
  return res.sort((a, b) => b.occurrences - a.occurrences || a.texte.localeCompare(b.texte)).slice(0, max);
}

/** Cette question est-elle déjà suggérée (par son identifiant, ou par son texte) ? */
export function estSuggeree(q: { id?: string; question: string }, suggestions: Suggestion[], questions: { id?: string; question: string }[] = []): boolean {
  if (q.id && suggestions.some((s) => s.questionId === q.id)) return true;
  return clesSuggerees(suggestions, questions).has(cleQuestion(q.question));
}
