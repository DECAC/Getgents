// Format demandé au modèle : terminer sa réponse par un bloc caché
// <!--IMAGE: {"prompt":"description détaillée en anglais de l'image à générer"}-->
// quand l'utilisateur demande explicitement une image et qu'un modèle de
// génération d'image est assigné au gent (voir IMAGE_PROMPT_INSTRUCTION,
// injectée uniquement si espace.imageModelId est défini — sinon le modèle
// conversationnel n'a de toute façon aucun moyen de produire une image).
const IMAGE_RE = /<!--IMAGE:\s*(\{[\s\S]*?\})\s*-->/;
const TRUNCATED_MARKER_RE = /<!--IMAGE:[\s\S]*$/;

export interface ImageSignal {
  prompt: string;
}

export const IMAGE_PROMPT_INSTRUCTION =
  "Un modèle de génération d'image est disponible pour ce gent. Quand l'utilisateur demande explicitement une image, une illustration, un visuel ou un schéma illustré, " +
  "réponds d'abord brièvement en une phrase (ex. « Voici l'illustration demandée : »), puis termine ta réponse (sur sa propre ligne, après tout le reste) par exactement un bloc : " +
  '<!--IMAGE: {"prompt":"description précise et détaillée de l\'image à générer, en anglais, avec le style souhaité"}--> ' +
  "Ne mentionne jamais que tu ne peux pas générer d'image : tu en as la capacité via ce mécanisme. N'émets ce bloc que si une image concrète a été demandée ou est manifestement utile — pas systématiquement.";

export function extractImageSignal(raw: string): { text: string; image: ImageSignal | null } {
  const match = raw.match(IMAGE_RE);
  if (!match) {
    const truncated = raw.match(TRUNCATED_MARKER_RE);
    if (truncated) return { text: raw.slice(0, truncated.index).trim(), image: null };
    return { text: raw, image: null };
  }

  let image: ImageSignal | null = null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed.prompt === "string" && parsed.prompt.trim()) {
      image = { prompt: parsed.prompt.trim().slice(0, 2000) };
    }
  } catch {
    // bloc malformé — on l'ignore et on affiche le texte sans lui
  }

  return { text: raw.slice(0, match.index).trim(), image };
}
