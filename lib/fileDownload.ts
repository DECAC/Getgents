import type { DownloadableDocument, DownloadLead, Espace } from "@/lib/types";
import type { GentDraft } from "@/lib/types/builder";

/** Adresse e-mail minimale : un @, un domaine, une extension. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Documents que le lecteur pourra télécharger en PDF : sources de connaissance
 * dont le texte a été lu, plus le document d'une visionneuse s'il y en a une.
 * Les liens URL sans contenu et les fichiers non extraits sont ignorés — on
 * ne peut pas fabriquer un PDF à partir d'un nom seul.
 */
export function downloadableDocumentsFromDraft(draft: GentDraft): DownloadableDocument[] {
  const docs: DownloadableDocument[] = [];
  const seen = new Set<string>();

  for (const source of draft.knowledgeSources ?? []) {
    const text = (source.text ?? "").trim();
    if (!text) continue;
    docs.push({ id: source.id, name: source.label, text });
    seen.add(source.label.trim().toLowerCase());
  }

  const vis = draft.visionneuse;
  if (vis?.enabled && vis.document) {
    const text = vis.document.pages.join("\n\n").trim();
    const name = vis.document.sourceName;
    if (text && !seen.has(name.trim().toLowerCase())) {
      docs.push({ id: "visionneuse-doc", name, text });
    }
  }

  return docs;
}

/**
 * Documents proposés au lecteur (Preview ou lien de diffusion).
 * Si la liste diffusée est vide, on retombe sur le document de la visionneuse
 * déjà présent dans l'espace — c'est le cas typique d'un compagnon de livre.
 */
export function downloadableDocumentsForReader(
  espace: Pick<Espace, "fileDownloadEnabled" | "downloadableDocuments" | "artefacts">
): DownloadableDocument[] {
  if (!espace.fileDownloadEnabled) return [];
  const listed = (espace.downloadableDocuments ?? []).filter((d) => (d.text ?? "").trim());
  if (listed.length) return listed;

  const vis = espace.artefacts?.find((a) => a.document);
  if (!vis?.document) return [];
  const text = vis.document.pages.join("\n\n").trim();
  if (!text) return [];
  return [{ id: vis.id, name: vis.document.sourceName || vis.title, text }];
}

export function isValidDownloadEmail(email: string): boolean {
  return EMAIL.test(email.trim());
}

export interface DownloadLeadForm {
  firstName: string;
  lastName: string;
  email: string;
  /** Jeton Turnstile : vide tant que le captcha n'est pas validé. */
  turnstileToken: string;
  /** Champ piège anti-robot : s'il est rempli, on refuse sans rien enregistrer. */
  honeypot: string;
}

export type DownloadLeadFormError =
  | "missing-name"
  | "invalid-email"
  | "captcha"
  | "honeypot";

/** Vérifie le formulaire de téléchargement. `null` = valide. */
export function validateDownloadLeadForm(form: DownloadLeadForm): DownloadLeadFormError | null {
  if (form.honeypot.trim() !== "") return "honeypot";
  if (!form.lastName.trim() || !form.firstName.trim()) return "missing-name";
  if (!isValidDownloadEmail(form.email)) return "invalid-email";
  if (!form.turnstileToken.trim()) return "captcha";
  return null;
}

export const DOWNLOAD_LEAD_FORM_MESSAGE: Record<Exclude<DownloadLeadFormError, "honeypot">, string> = {
  "missing-name": "Indiquez votre nom et votre prénom.",
  "invalid-email": "Indiquez une adresse e-mail valide.",
  captcha: "Validez le captcha « Vous n’êtes pas un robot » pour continuer.",
};

/** Nom de fichier PDF sûr, dérivé du document d'origine. */
export function pdfFileName(sourceName: string): string {
  const base = sourceName.replace(/\.[^.\\/]+$/, "").trim() || "document";
  const safe = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return `${safe || "document"}.pdf`;
}

export function newDownloadLead(
  form: Pick<DownloadLeadForm, "firstName" | "lastName" | "email">,
  meta: { gentId: string; gentName: string; fileName?: string }
): DownloadLead {
  return {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    gentId: meta.gentId,
    gentName: meta.gentName,
    fileName: meta.fileName,
  };
}
