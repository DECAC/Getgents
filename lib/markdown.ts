import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

// Convertit la sortie markdown du modèle en HTML — le résultat doit toujours
// passer par SafeHTML/DOMPurify avant d'être injecté dans le DOM.
export function renderMarkdown(raw: string): string {
  return marked.parse(raw, { async: false }) as string;
}
