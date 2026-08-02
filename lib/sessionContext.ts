import type { Espace, UserFile } from "@/lib/types";

// Contexte de session partagé par les deux modes d'un gent : la conversation et
// l'artefact figé « mini-app ». Mémoire de l'espace et documents téléversés
// doivent nourrir les deux de la même façon — auparavant la mémoire n'alimentait
// que le chat, et les fichiers n'étaient qu'un affichage décoratif.

/**
 * Budget de caractères accordé aux documents dans un prompt. Au-delà, les
 * derniers fichiers sont annoncés sans leur contenu : mieux vaut un contexte
 * amputé et signalé qu'une requête trop lourde (déjà à l'origine de
 * « Failed to fetch » par le passé).
 */
export const FILES_CONTEXT_BUDGET = 30_000;

export function memoryNote(memory?: string): string {
  const m = (memory ?? "").trim();
  return m ? `\n\nMémoire de l'espace : ${m}` : "";
}

/** Bloc décrivant les documents de la session, tronqué pour tenir le budget. */
export function filesNote(files: UserFile[] | undefined): string {
  const withText = (files ?? []).filter((f) => (f.text ?? "").trim() !== "");
  if (withText.length === 0) return "";

  const parts: string[] = [];
  const omitted: string[] = [];
  let used = 0;

  for (const f of withText) {
    const body = (f.text ?? "").trim();
    if (used + body.length > FILES_CONTEXT_BUDGET) {
      omitted.push(f.name);
      continue;
    }
    used += body.length;
    parts.push(`--- ${f.name}${f.truncated ? " (extrait tronqué)" : ""} ---\n${body}`);
  }

  if (parts.length === 0) {
    return `\n\nDOCUMENTS DE LA SESSION : ${withText.length} fichier(s) fourni(s), trop volumineux pour être inclus (${withText
      .map((f) => f.name)
      .join(", ")}).`;
  }

  let note = `\n\nDOCUMENTS DE LA SESSION (fournis par l'utilisateur, à utiliser comme source) :\n${parts.join("\n\n")}`;
  if (omitted.length) {
    note += `\n\n(Non inclus faute de place : ${omitted.join(", ")}. Signale-le si la réponse en dépend.)`;
  }
  return note;
}

/** Mémoire + documents, dans l'ordre attendu par les prompts. */
export function sessionContextNote(espace: Pick<Espace, "memory" | "files">): string {
  return `${memoryNote(espace.memory)}${filesNote(espace.files)}`;
}
