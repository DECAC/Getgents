/**
 * Questions d'amorce tirées de la BOÎTE MAIL du créateur (gent Gmail).
 *
 * Les amorces génériques (« Quels sont les emails importants… ») ne disaient
 * rien de sa boîte. Celles-ci citent ses expéditeurs et ses sujets réels :
 * « Que dit The Batch cette semaine ? ». Elles sont produites à partir des
 * seuls EN-TÊTES (expéditeur, objet) des messages récents — jamais du corps.
 *
 * CONFIDENTIALITÉ : elles révèlent l'activité de la boîte. Elles ne vivent que
 * dans l'espace PERSONNEL du propriétaire : absentes de la projection publique
 * (liste blanche), retirées de l'aperçu, et jamais écrites dans `starters`,
 * que les visiteurs reçoivent.
 *
 * Module PUR.
 */

export interface AmorcesContextuelles {
  /** ISO — date de production. */
  at: string;
  items: string[];
}

export interface EnTeteMail {
  from: string;
  subject: string;
}

/** Au-delà, on les refait : une boîte mail change dans la journée. */
export const VALIDITE_AMORCES_MS = 6 * 60 * 60 * 1000;
export const NOMBRE_AMORCES = 4;

export function amorcesAJour(a: AmorcesContextuelles | undefined, maintenant = Date.now()): boolean {
  if (!a?.items?.length) return false;
  const t = Date.parse(a.at);
  return Number.isFinite(t) && maintenant - t < VALIDITE_AMORCES_MS;
}

/** « The Batch <thebatch@deeplearning.ai> » → « The Batch » ; une adresse nue reste l'adresse. */
export function nomExpediteur(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return (m ? m[1] : from).trim();
}

export function consigneAmorces(entetes: EnTeteMail[], nomGent: string): string {
  const liste = entetes
    .slice(0, 25)
    .map((e) => `- ${nomExpediteur(e.from)} — ${e.subject || "(sans objet)"}`)
    .join("\n");
  return (
    `Tu prépares les questions d'amorce de « ${nomGent} », l'assistant de la boîte mail de son utilisateur.\n` +
    "Voici l'expéditeur et l'objet des messages reçus ces derniers jours :\n" +
    `${liste}\n\n` +
    `Propose ${NOMBRE_AMORCES} questions que l'utilisateur aurait envie de poser MAINTENANT à son assistant, ` +
    "en citant nommément les expéditeurs, newsletters ou sujets de cette liste (ex. « Que retenir de The Batch cette semaine ? »). " +
    "Varie les usages : résumer une newsletter, faire le point sur un fil, préparer une réponse, repérer ce qui demande une action. " +
    "Chaque question : une phrase courte (12 mots au plus), à la deuxième personne, sans guillemets. " +
    "N'invente AUCUN expéditeur ni sujet absent de la liste. Ne cite aucune adresse e-mail.\n\n" +
    'Réponds UNIQUEMENT par un tableau JSON de chaînes, par exemple : ["Question 1 ?", "Question 2 ?"]'
  );
}

/** Lit la réponse du modèle ; tout ce qui n'est pas une liste de phrases courtes est écarté. */
export function lireAmorces(texte: string): string[] {
  const debut = texte.indexOf("[");
  const fin = texte.lastIndexOf("]");
  if (debut < 0 || fin <= debut) return [];
  let brut: unknown;
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/\s+/g, " ").trim())
    // Une adresse dans une amorce afficherait un contact en clair : écartée.
    .filter((x) => x.length >= 8 && x.length <= 140 && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(x))
    .slice(0, NOMBRE_AMORCES);
}
