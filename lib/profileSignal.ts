// Profil utilisateur structuré : pendant l'onboarding (conversation, CV joint),
// le modèle émet un bloc caché PROFILE — on l'extrait pour afficher une carte
// de validation dans le fil, comme un artefact. Une fois accepté, le profil
// est stocké dans l'espace (persisté côté serveur avec le reste) et réinjecté
// dans le prompt système : c'est lui qui calibrera la veille automatisée
// (requêtes de collecte, scoring de pertinence).
const PROFILE_RE = /<!--PROFILE:\s*(\{[\s\S]*?\})\s*-->/;

export interface UserProfile {
  /** Métier / poste recherché — seul champ obligatoire. */
  metier: string;
  seniorite?: string;
  competences?: string[];
  localisation?: string;
  /** Mobilité : télétravail, hybride, rayon géographique… */
  mobilite?: string;
  salaireCible?: string;
  typesContrat?: string[];
  secteurs?: string[];
  /** Ce que l'utilisateur ne veut PAS (secteurs, entreprises, types de poste). */
  exclusions?: string[];
  /** Résumé libre en une phrase, affiché en tête de carte. */
  resume?: string;
}

export const PROFILE_PROMPT_INSTRUCTION =
  "PROFIL UTILISATEUR : quand la conversation (ou un document joint, ex. un CV) t'apprend des éléments sur le parcours, le métier, les compétences ou les attentes professionnelles de l'utilisateur, propose un profil structuré en terminant ta réponse (sur sa propre ligne) par exactement un bloc : " +
  '<!--PROFILE: {"metier":"...","seniorite":"...","competences":["..."],"localisation":"...","mobilite":"...","salaireCible":"...","typesContrat":["..."],"secteurs":["..."],"exclusions":["..."],"resume":"une phrase"}--> ' +
  "Règles : \"metier\" est obligatoire, tous les autres champs sont optionnels — n'invente JAMAIS une valeur non déduite de la conversation ou du document, omets le champ plutôt. " +
  "Si un profil est déjà connu (indiqué dans le contexte), n'émets un nouveau bloc QUE si tu as des éléments nouveaux ou corrigés, en ré-émettant alors le profil COMPLET mis à jour (le nouveau remplace l'ancien). " +
  "L'utilisateur valide le profil via une carte dans la conversation — ne dis jamais qu'il est déjà enregistré. Un seul bloc PROFILE par réponse.";

function str(v: unknown, max = 200): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function strList(v: unknown, maxItems = 12, maxLen = 80): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => str(x, maxLen))
    .filter((x): x is string => x !== undefined)
    .slice(0, maxItems);
  return out.length ? out : undefined;
}

export function parseProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const metier = str(p.metier, 120);
  if (!metier) return null;
  return {
    metier,
    seniorite: str(p.seniorite, 80),
    competences: strList(p.competences),
    localisation: str(p.localisation, 120),
    mobilite: str(p.mobilite, 160),
    salaireCible: str(p.salaireCible, 80),
    typesContrat: strList(p.typesContrat, 6, 40),
    secteurs: strList(p.secteurs),
    exclusions: strList(p.exclusions),
    resume: str(p.resume, 300),
  };
}

export function extractProfileSignal(raw: string): { text: string; profile: UserProfile | null } {
  const match = raw.match(PROFILE_RE);
  if (!match) return { text: raw, profile: null };
  const start = match.index ?? 0;
  const text = (raw.slice(0, start) + raw.slice(start + match[0].length)).trim();
  try {
    return { text, profile: parseProfile(JSON.parse(match[1])) };
  } catch {
    return { text, profile: null };
  }
}

/** Note de contexte injectée dans le prompt système quand un profil est connu. */
export function profileContextNote(profile: UserProfile): string {
  const lines: string[] = [`- Métier / poste visé : ${profile.metier}`];
  if (profile.seniorite) lines.push(`- Séniorité : ${profile.seniorite}`);
  if (profile.competences?.length) lines.push(`- Compétences : ${profile.competences.join(", ")}`);
  if (profile.localisation) lines.push(`- Localisation : ${profile.localisation}`);
  if (profile.mobilite) lines.push(`- Mobilité : ${profile.mobilite}`);
  if (profile.salaireCible) lines.push(`- Salaire cible : ${profile.salaireCible}`);
  if (profile.typesContrat?.length) lines.push(`- Types de contrat : ${profile.typesContrat.join(", ")}`);
  if (profile.secteurs?.length) lines.push(`- Secteurs : ${profile.secteurs.join(", ")}`);
  if (profile.exclusions?.length) lines.push(`- À exclure : ${profile.exclusions.join(", ")}`);
  return `Profil utilisateur validé (à utiliser pour personnaliser tes réponses) :\n${lines.join("\n")}`;
}
