/**
 * Artefact « résumé de profil » : CV percutant et synthétique d'une personne
 * (pas le profil utilisateur PROFILE de l'espace). Illustré par logos / photos
 * web ou images à générer (après autorisation).
 */

export type ProfileMediaRole = "portrait" | "logo" | "cover" | "illustration";

export interface ProfileSummaryMediaSpec {
  role: ProfileMediaRole;
  kind: "web" | "generate";
  /** URL https (kind web) — logo entreprise, photo publique, etc. */
  url?: string;
  /** Prompt de génération (kind generate), de préférence en anglais. */
  prompt?: string;
  caption?: string;
}

/** Média une fois matérialisé dans l'artefact (après ajout / génération). */
export interface ProfileSummaryMedia extends ProfileSummaryMediaSpec {
  id: string;
  /** URL affichable (https ou data:image) une fois prête. */
  imageUrl?: string;
  status: "ready" | "pending" | "generating" | "error";
}

export interface ProfileExperience {
  title: string;
  org?: string;
  period?: string;
  highlight?: string;
}

export interface ProfileEducation {
  title: string;
  org?: string;
  period?: string;
}

export interface ProfileSummary {
  /** Nom de la personne (obligatoire). */
  name: string;
  /** Accroche / titre professionnel en une ligne. */
  headline?: string;
  location?: string;
  /** Pitch synthétique (2–4 phrases max). */
  summary?: string;
  experience?: ProfileExperience[];
  education?: ProfileEducation[];
  skills?: string[];
  /** Faits marquants / réalisations (puces courtes). */
  highlights?: string[];
  links?: { label: string; url: string }[];
  /** Illustrations proposées (web ou à générer). */
  media?: ProfileSummaryMediaSpec[];
}

export const PROFILE_SUMMARY_PROMPT_INSTRUCTION =
  "RÉSUMÉ DE PROFIL : dès que la conversation porte sur le parcours d'une PERSONNE EN PARTICULIER " +
  "(candidat, contact, interlocuteur, personnalité publique, profil LinkedIn/CV analysé — pas un simple métier abstrait), " +
  "propose un artefact « résumé de profil » façon CV percutant et synthétique. " +
  "Termine ta réponse (après le texte visible, sur sa propre ligne) par exactement un bloc : " +
  '<!--ARTEFACT: {"kind":"profile-summary","title":"Prénom Nom — résumé","profileSummary":{' +
  '"name":"Prénom Nom","headline":"Titre percutant","location":"Ville","summary":"Pitch en 2-4 phrases",' +
  '"experience":[{"title":"Poste","org":"Entreprise","period":"2020–2024","highlight":"Résultat clé"}],' +
  '"education":[{"title":"Diplôme","org":"École","period":"2015"}],' +
  '"skills":["Compétence 1","Compétence 2"],' +
  '"highlights":["Réalisation marquante"],' +
  '"links":[{"label":"LinkedIn","url":"https://…"}],' +
  '"media":[{"role":"portrait|logo|cover|illustration","kind":"web|generate","url":"https://…","prompt":"…","caption":"…"}]' +
  "}}--> " +
  "Règles : (1) n'invente pas de faits — omets les champs inconnus ; (2) vise la synthèse (max 4 expériences, 8 skills, 5 highlights) ; " +
  "(3) pour illustrer : logos d'entreprises ou photos trouvées sur le web (kind web + url https) et/ou 1–2 illustrations à générer " +
  "(kind generate + prompt en anglais, ex. portrait stylisé sobre, cover abstract) — max 4 médias ; " +
  "(4) ne dis jamais que le résumé est déjà dans l'espace — l'utilisateur l'ajoute via le bouton ; " +
  "(5) un seul artefact par réponse ; si un scoring chiffré domine, préfère dashboard, sinon privilégie profile-summary dès qu'il s'agit d'une personne.";

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function isHttps(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

const ROLES: ProfileMediaRole[] = ["portrait", "logo", "cover", "illustration"];

function parseMedia(raw: unknown): ProfileSummaryMediaSpec[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProfileSummaryMediaSpec[] = [];
  for (const item of raw.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const role = ROLES.includes(m.role as ProfileMediaRole) ? (m.role as ProfileMediaRole) : "illustration";
    if (m.kind === "web" && isHttps(m.url)) {
      out.push({
        role,
        kind: "web",
        url: (m.url as string).trim(),
        caption: str(m.caption, 160),
      });
    } else if (m.kind === "generate" && typeof m.prompt === "string" && m.prompt.trim()) {
      out.push({
        role,
        kind: "generate",
        prompt: m.prompt.trim().slice(0, 2000),
        caption: str(m.caption, 160),
      });
    }
  }
  return out.length ? out : undefined;
}

function parseExperience(raw: unknown): ProfileExperience[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProfileExperience[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const title = str(e.title, 120);
    if (!title) continue;
    out.push({
      title,
      org: str(e.org, 120),
      period: str(e.period, 60),
      highlight: str(e.highlight, 220),
    });
  }
  return out.length ? out : undefined;
}

function parseEducation(raw: unknown): ProfileEducation[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ProfileEducation[] = [];
  for (const item of raw.slice(0, 4)) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const title = str(e.title, 120);
    if (!title) continue;
    out.push({ title, org: str(e.org, 120), period: str(e.period, 60) });
  }
  return out.length ? out : undefined;
}

export function parseProfileSummary(raw: unknown): ProfileSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const name = str(p.name, 120);
  if (!name) return null;

  const skills = Array.isArray(p.skills)
    ? p.skills.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim().slice(0, 60)).slice(0, 12)
    : undefined;
  const highlights = Array.isArray(p.highlights)
    ? p.highlights.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim().slice(0, 160)).slice(0, 6)
    : undefined;
  const links = Array.isArray(p.links)
    ? p.links
        .map((l) => {
          if (!l || typeof l !== "object") return null;
          const o = l as Record<string, unknown>;
          const label = str(o.label, 60);
          if (!label || !isHttps(o.url)) return null;
          return { label, url: (o.url as string).trim() };
        })
        .filter((x): x is { label: string; url: string } => !!x)
        .slice(0, 6)
    : undefined;

  return {
    name,
    headline: str(p.headline, 160),
    location: str(p.location, 120),
    summary: str(p.summary, 800),
    experience: parseExperience(p.experience),
    education: parseEducation(p.education),
    skills: skills?.length ? skills : undefined,
    highlights: highlights?.length ? highlights : undefined,
    links: links?.length ? links : undefined,
    media: parseMedia(p.media),
  };
}

/** Prépare les médias pour stockage dans l'artefact (web prêts, generate en attente). */
export function materializeProfileMedia(specs: ProfileSummaryMediaSpec[] | undefined): ProfileSummaryMedia[] {
  if (!specs?.length) return [];
  return specs.map((m, i) => {
    const id = `pm-${Date.now()}-${i}`;
    if (m.kind === "web" && m.url) {
      return { ...m, id, imageUrl: m.url, status: "ready" as const };
    }
    return { ...m, id, status: "pending" as const };
  });
}
