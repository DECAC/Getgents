// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--QUESTIONS: [{"q":"...","options":["...","..."],"multi":false}]-->
// quand la réponse pose une ou plusieurs questions fermées. On l'extrait
// avant affichage pour construire des puces cliquables numérotées.
//
// Relances conversationnelles (distinctes) :
// <!--FOLLOWUPS: ["Question libre 1 ?","Question libre 2 ?"]-->
const QUESTIONS_MARKER_RE = /<!--\s*QUESTIONS\s*:/i;
const FOLLOWUPS_RE = /<!--FOLLOWUPS:\s*(\[[\s\S]*?\])\s*-->/;
const LIST_ITEM_RE = /^\s*(?:[-*•]|\d+[.)])\s+\S/;
const OPTIONS_HEADING_RE = /^\s*(?:\*\*)?(?:options?|choix|propositions?)(?:\*\*)?\s*:?\s*$/i;

export interface QuestionBlock {
  q: string;
  options: string[];
  multi?: boolean;
}

/** Ajoutée automatiquement par l'interface — ne pas demander au modèle de l'inclure. */
export const QUICK_REPLY_OTHER_LABEL = "Autre";

/**
 * Porte de sortie des questions de cadrage : le créateur n'a pas d'avis et
 * laisse l'assistant trancher. Comme « Autre », elle est ajoutée par
 * l'interface — le modèle ne doit jamais l'émettre lui-même, sinon elle
 * apparaîtrait en double.
 */
export const QUICK_REPLY_TRUST_LABEL = "Fais-moi confiance";

/** Vrai si la réponse du créateur est un « fais-moi confiance ». */
export function isTrustAnswer(answer: string): boolean {
  return answer.toLowerCase().includes(QUICK_REPLY_TRUST_LABEL.toLowerCase());
}

export const SUGGESTIONS_PROMPT_INSTRUCTION =
  "Dès que tu poses une question à l'utilisateur (choix à faire, confirmation, préférence, suite à donner), tu DOIS terminer ta réponse (après le texte visible, sur sa propre ligne, jamais dans le corps du message) par un bloc : " +
  '<!--QUESTIONS: [{"q":"Intitulé exact de la question","options":["Option A","Option B","Option C"],"multi":false}]--> ' +
  "Règles impératives : (1) SYSTÉMATIQUE — chaque question posée dans ta réponse exige ce bloc, sans exception ; (2) une entrée par question posée, dans l'ordre ; (3) 2 à 4 options courtes en français, contextualisées au fil (reprends les choix que tu viens d'évoquer) ; (4) \"multi\": false par défaut — \"multi\": true seulement si plusieurs choix simultanés ont du sens ; (5) ne liste PAS les options en puces ou tirets dans le texte visible — pose la question en une phrase puis laisse l'interface afficher les boutons ; (6) n'inclus PAS l'option « Autre » dans le JSON — l'interface l'ajoute automatiquement avec un champ libre. " +
  "Exemple : « Veux-tu que j'envoie cet e-mail ? » → <!--QUESTIONS: [{\"q\":\"Veux-tu que j'envoie cet e-mail ?\",\"options\":[\"Oui, envoie-le\",\"Non, prépare seulement un brouillon\"],\"multi\":false}]-->. " +
  "Si tu ne poses aucune question, n'émet pas de bloc QUESTIONS.";

/**
 * Retire les options que l'INTERFACE ajoute elle-même. Sans ce filtre, un
 * modèle qui reprend « Autre » ou « Fais-moi confiance » dans son JSON les
 * ferait apparaître en double dans la liste.
 */
function withoutUiOptions(options: string[]): string[] {
  const reserved = [QUICK_REPLY_OTHER_LABEL.toLowerCase(), QUICK_REPLY_TRUST_LABEL.toLowerCase()];
  return options
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && !reserved.includes(o.toLowerCase()));
}

function parseQuestionBlocks(parsed: unknown): QuestionBlock[] {
  const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
  return items
    .filter(
      (item): item is QuestionBlock =>
        !!item &&
        typeof item.q === "string" &&
        Array.isArray(item.options) &&
        item.options.every((o: unknown) => typeof o === "string")
    )
    .map((item) => ({
      q: item.q.trim().slice(0, 240),
      options: withoutUiOptions(item.options).slice(0, 5),
      multi: !!item.multi,
    }))
    .filter((item) => item.q.length > 0 && item.options.length >= 1)
    .slice(0, 6);
}

/** JSON `[…]` / `{…}` équilibré, en ignorant les crochets qui sont dans une chaîne. */
function sliceBalancedJson(raw: string, from: number): { json: string; end: number } | null {
  let start = -1;
  for (let i = from; i < raw.length; i++) {
    const c = raw[i];
    if (c === "[" || c === "{") {
      start = i;
      break;
    }
    if (!/\s/.test(c)) return null;
  }
  if (start < 0) return null;

  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[") stack.push("]");
    else if (c === "{") stack.push("}");
    else if (c === "]" || c === "}") {
      if (stack.pop() !== c) return null;
      if (stack.length === 0) return { json: raw.slice(start, i + 1), end: i + 1 };
    }
  }
  return null;
}

/**
 * Retire une liste à puces / numérotée en fin de message (et les lignes qui
 * recopient déjà les options). L'interface affiche ces choix en boutons.
 */
export function stripVisibleChoiceList(text: string, options?: string[]): string {
  let t = text.replace(/\r\n/g, "\n").trim();
  if (options?.length) {
    const optSet = new Set(options.map((o) => o.trim().toLowerCase()));
    t = t
      .split("\n")
      .filter((line) => {
        const cleaned = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").replace(/[*_]/g, "").trim().toLowerCase();
        return !cleaned || !optSet.has(cleaned);
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const lines = t.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  if (i < 0 || !LIST_ITEM_RE.test(lines[i])) return t;
  while (i >= 0 && (LIST_ITEM_RE.test(lines[i]) || !lines[i].trim())) i--;
  if (i >= 0 && OPTIONS_HEADING_RE.test(lines[i])) i--;
  return lines.slice(0, i + 1).join("\n").trim();
}

/**
 * Repli : le modèle a listé les choix en markdown sans bloc QUESTIONS.
 * On transforme la liste finale en boutons, et on ne garde que la question.
 */
export function recoverQuestionsFromChoiceList(text: string): { text: string; questions: QuestionBlock[] } {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  const items: string[] = [];
  while (i >= 0) {
    const line = lines[i];
    if (!line.trim()) {
      if (items.length) break;
      i--;
      continue;
    }
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (!m) break;
    items.unshift(m[1].replace(/\s+/g, " ").trim());
    i--;
  }
  if (items.length < 2 || items.length > 6) return { text, questions: [] };
  if (i >= 0 && OPTIONS_HEADING_RE.test(lines[i])) i--;
  const qText = lines.slice(0, i + 1).join("\n").trim();
  if (!qText) return { text, questions: [] };
  const options = withoutUiOptions(items).slice(0, 5);
  if (options.length < 2) return { text, questions: [] };
  const q = (qText.split(/\n\n+/).pop() ?? qText).replace(/^#+\s*/, "").trim().slice(0, 240);
  return { text: qText, questions: [{ q, options, multi: false }] };
}

/**
 * Relances pour poursuivre l'échange — régulièrement, pas à chaque message.
 * Affichées en puces : un clic envoie la question telle quelle.
 */
export const FOLLOWUPS_PROMPT_INSTRUCTION =
  "Pour inciter l'utilisateur à poursuivre la conversation, propose RÉGULIÈREMENT (environ une réponse sur deux ou trois quand tu as livré une info utile, un conseil ou un récap) " +
  "2 ou 3 questions de suite pertinentes, formulées comme l'utilisateur les poserait. " +
  "Termine alors ta réponse (après le texte visible et après un éventuel bloc QUESTIONS, sur sa propre ligne) par exactement : " +
  '<!--FOLLOWUPS: ["Question libre 1 ?","Question libre 2 ?","Question libre 3 ?"]--> ' +
  "Règles : (1) questions courtes en français, concrètes, liées au fil en cours ; (2) 2 ou 3 max ; (3) PAS à chaque réponse — saute les messages purement procéduraux " +
  "(simple accusé, demande d'une seule info manquante, oui/non, ou quand tu viens déjà d'émettre un bloc QUESTIONS fermées) ; " +
  "(4) ne liste PAS ces relances dans le texte visible — l'interface les affichera en boutons ; " +
  "(5) n'émets jamais plus d'un bloc FOLLOWUPS par réponse.";

export function extractQuestions(raw: string): { text: string; questions: QuestionBlock[] } {
  const marker = raw.match(QUESTIONS_MARKER_RE);
  if (marker && marker.index !== undefined) {
    const sliced = sliceBalancedJson(raw, marker.index + marker[0].length);
    if (!sliced) {
      return { text: raw.slice(0, marker.index).trim(), questions: [] };
    }
    let questions: QuestionBlock[] = [];
    try {
      questions = parseQuestionBlocks(JSON.parse(sliced.json));
    } catch {
      // ignore malformed block
    }
    const after = raw.slice(sliced.end);
    const closer = after.match(/^\s*-->/);
    const end = sliced.end + (closer ? closer[0].length : 0);
    const text = stripVisibleChoiceList(
      (raw.slice(0, marker.index) + raw.slice(end)).trim(),
      questions.flatMap((q) => q.options)
    );
    return { text, questions };
  }

  const fence = raw.match(/```(?:json)?\s*/i);
  if (fence && fence.index !== undefined) {
    const sliced = sliceBalancedJson(raw, fence.index + fence[0].length);
    if (sliced) {
      try {
        const questions = parseQuestionBlocks(JSON.parse(sliced.json));
        if (questions.length) {
          const after = raw.slice(sliced.end);
          const closer = after.match(/^\s*```/);
          const end = sliced.end + (closer ? closer[0].length : 0);
          const text = stripVisibleChoiceList(
            (raw.slice(0, fence.index) + raw.slice(end)).trim(),
            questions.flatMap((q) => q.options)
          );
          return { text, questions };
        }
      } catch {
        // pas un bloc de questions
      }
    }
  }

  return { text: raw, questions: [] };
}

export function extractFollowups(raw: string): { text: string; followups: string[] } {
  const match = raw.match(FOLLOWUPS_RE);
  if (!match) {
    const truncated = raw.match(/<!--FOLLOWUPS:[\s\S]*$/);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), followups: [] };
    return { text: raw, followups: [] };
  }

  let followups: string[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      followups = parsed
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 160))
        .slice(0, 3);
    }
  } catch {
    // ignore malformed block
  }

  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  return { text, followups };
}
