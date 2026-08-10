// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--IMAGE: {"kind":"generate","title":"...","prompt":"..."}-->
// ou <!--IMAGE: {"kind":"web","title":"...","url":"https://...","caption":"..."}-->
// Le client NE génère / n'affiche JAMAIS sans accord explicite de l'utilisateur
// (carte dans le fil → bouton « Autoriser »).

const IMAGE_RE = /<!--IMAGE:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--IMAGE:[\s\S]*$/;

export type ImageProposalKind = "generate" | "web";

export interface ImageProposal {
  kind: ImageProposalKind;
  title: string;
  /** Prompt de génération (kind === "generate"), en anglais de préférence. */
  prompt?: string;
  /** URL https d'une photo trouvée sur le web (kind === "web"). */
  url?: string;
  /** Légende courte sous l'image. */
  caption?: string;
}

/** @deprecated Utiliser ImageProposal — conservé pour les imports existants. */
export type ImageSignal = ImageProposal;

/**
 * Injectée quand un modèle image est assigné au gent. Les illustrations
 * servent à éclairer un propos ; la génération réelle attend l'autorisation
 * utilisateur (carte dans le chat).
 */
export const IMAGE_PROMPT_INSTRUCTION =
  "Tu peux PROPOSER une illustration pour éclairer un propos (schéma, ambiance, objet, lieu). " +
  "N'affirme jamais que l'image est déjà générée : l'utilisateur doit d'abord autoriser via un bouton. " +
  "Quand une illustration générée est utile, termine ta réponse (sur sa propre ligne, après le reste) par exactement un bloc : " +
  '<!--IMAGE: {"kind":"generate","title":"Titre court","prompt":"description précise en anglais, style clair et sobre"}--> ' +
  "Tu peux aussi proposer une photo trouvée via la recherche web (URL https directe d'une image libre de droits ou d'une source crédible) : " +
  '<!--IMAGE: {"kind":"web","title":"Titre court","url":"https://…","caption":"légende optionnelle"}--> ' +
  "Un seul bloc IMAGE par réponse. Pas d'illustration décorative gratuite : uniquement pour servir le propos. " +
  "Ne mentionne jamais que tu es incapable de produire une image.";

/**
 * Variante sans génération IA : photos web uniquement (pas de modèle image assigné).
 */
export const WEB_IMAGE_PROMPT_INSTRUCTION =
  "Tu peux PROPOSER d'afficher une photo du web pour illustrer un propos (URL https directe d'une image). " +
  "N'affirme jamais que la photo est déjà affichée : l'utilisateur doit d'abord autoriser via un bouton. " +
  "Quand c'est utile, termine ta réponse (sur sa propre ligne) par exactement un bloc : " +
  '<!--IMAGE: {"kind":"web","title":"Titre court","url":"https://…","caption":"légende optionnelle"}--> ' +
  "Un seul bloc IMAGE par réponse. Pas d'illustration décorative gratuite.";

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractImageSignal(raw: string): { text: string; image: ImageProposal | null } {
  const match = raw.match(IMAGE_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), image: null };
    return { text: raw, image: null };
  }

  let image: ImageProposal | null = null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      // Compat : ancien format {"prompt":"..."} sans kind → generate
      const kindRaw = typeof parsed.kind === "string" ? parsed.kind : parsed.prompt ? "generate" : parsed.url ? "web" : null;
      const title =
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim().slice(0, 120)
          : kindRaw === "web"
            ? "Photo"
            : "Illustration";

      if (kindRaw === "generate" && typeof parsed.prompt === "string" && parsed.prompt.trim()) {
        image = {
          kind: "generate",
          title,
          prompt: parsed.prompt.trim().slice(0, 2000),
          caption: typeof parsed.caption === "string" ? parsed.caption.trim().slice(0, 300) : undefined,
        };
      } else if (kindRaw === "web" && isHttpsUrl(parsed.url)) {
        image = {
          kind: "web",
          title,
          url: (parsed.url as string).trim(),
          caption: typeof parsed.caption === "string" ? parsed.caption.trim().slice(0, 300) : undefined,
        };
      }
    }
  } catch {
    // bloc malformé — on l'ignore et on affiche le texte sans lui
  }

  return { text: raw.slice(0, match.index).trim(), image };
}

/** Libellé stable de la rubrique Images dans le canvas (onglet thématique). */
export const IMAGES_THEME_LABEL = "Images";
