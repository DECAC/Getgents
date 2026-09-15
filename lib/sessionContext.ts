import type { Espace, UserFile } from "@/lib/types";
import { MODEL_CATALOG } from "@/lib/mock-data/builder";

// Contexte de session partagé par les deux modes d'un gent : la conversation et
// l'artefact figé « mini-app ». Mémoire de l'espace et documents téléversés
// doivent nourrir les deux de la même façon — auparavant la mémoire n'alimentait
// que le chat, et les fichiers n'étaient qu'un affichage décoratif.

/**
 * Estimation caractères → tokens pour du texte français (un peu moins efficace
 * que l'anglais). Sert à dimensionner le budget documentaire par rapport à la
 * fenêtre de contexte du modèle, pas à compter précisément.
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Part de la fenêtre de contexte allouée aux documents. Le reste couvre le
 * prompt système (instructions plateforme + consigne du créateur), l'historique
 * de conversation et la réponse.
 */
const DOCUMENTS_CONTEXT_SHARE = 0.6;

/** Fenêtre supposée quand le modèle est inconnu : la plus petite du catalogue. */
const FALLBACK_CONTEXT_WINDOW = 128_000;

/**
 * Plafond dur. Au-delà, ce n'est plus la fenêtre du modèle qui contraint mais
 * le poids de la requête (l'espace voyage en JSON à chaque message).
 */
const MAX_DOCUMENTS_BUDGET = 400_000;
/** Plancher : en dessous, un document un peu long ne dirait plus rien d'utile. */
const MIN_DOCUMENTS_BUDGET = 30_000;

/**
 * Budget de caractères accordé aux documents, dérivé de la fenêtre de contexte
 * du modèle du gent. Un document d'une centaine de pages (~280 000 caractères)
 * tient sur tous les modèles du catalogue ; sur les plus petites fenêtres
 * (128k tokens) il est tronqué plutôt que de faire déborder la requête.
 */
export function documentsBudgetFor(modelId?: string): number {
  const contextWindow = MODEL_CATALOG.find((m) => m.id === modelId)?.contextWindow ?? FALLBACK_CONTEXT_WINDOW;
  const chars = Math.floor(contextWindow * DOCUMENTS_CONTEXT_SHARE * CHARS_PER_TOKEN);
  return Math.min(MAX_DOCUMENTS_BUDGET, Math.max(MIN_DOCUMENTS_BUDGET, chars));
}

/**
 * Budget par défaut (modèle inconnu) — conservé pour les appelants qui ne
 * connaissent pas le modèle du gent.
 */
export const FILES_CONTEXT_BUDGET = documentsBudgetFor(undefined);

export function memoryNote(memory?: string): string {
  const m = (memory ?? "").trim();
  return m ? `\n\nMémoire de l'espace : ${m}` : "";
}

/**
 * Bloc décrivant les documents de la session, borné par le budget.
 *
 * Un document qui dépasse à lui seul le budget est TRONQUÉ, pas écarté : avec
 * l'ancien comportement, un livre blanc de cent pages était annoncé comme
 * « trop volumineux » et le gent répondait sans en avoir lu une ligne.
 */
export function filesNote(files: UserFile[] | undefined, budget: number = FILES_CONTEXT_BUDGET): string {
  const withText = (files ?? []).filter((f) => (f.text ?? "").trim() !== "");
  if (withText.length === 0) return "";

  const parts: string[] = [];
  const omitted: string[] = [];
  const shortened: string[] = [];
  let used = 0;

  for (const f of withText) {
    const body = (f.text ?? "").trim();
    const left = budget - used;
    // Sous ce seuil, l'extrait restant serait trop court pour être exploitable :
    // mieux vaut nommer le document que d'en livrer trois lignes.
    if (left < 2_000) {
      omitted.push(f.name);
      continue;
    }
    if (body.length > left) {
      used = budget;
      shortened.push(f.name);
      parts.push(
        `--- ${f.name} (document long : seuls les ${left.toLocaleString("fr-FR")} premiers caractères sont fournis) ---\n${body.slice(0, left)}`
      );
      continue;
    }
    used += body.length;
    parts.push(`--- ${f.name}${f.truncated ? " (extrait tronqué)" : ""} ---\n${body}`);
  }

  let note = `\n\nDOCUMENTS DE LA SESSION (fournis par l'utilisateur, à utiliser comme source) :\n${parts.join("\n\n")}`;
  if (shortened.length) {
    note +=
      `\n\n(Document(s) fourni(s) partiellement : ${shortened.join(", ")}. ` +
      "Réponds sur la base de ce que tu as réellement reçu et dis clairement à l'utilisateur quand sa question porte sur une partie que tu n'as pas sous les yeux — n'invente jamais le contenu manquant.)";
  }
  if (omitted.length) {
    note += `\n\n(Non inclus faute de place : ${omitted.join(", ")}. Signale-le si la réponse en dépend.)`;
  }
  return note;
}

/** Mémoire + documents, dans l'ordre attendu par les prompts. */
export function sessionContextNote(espace: Pick<Espace, "memory" | "files"> & { chatModelId?: string }): string {
  return `${memoryNote(espace.memory)}${filesNote(espace.files, documentsBudgetFor(espace.chatModelId))}`;
}
