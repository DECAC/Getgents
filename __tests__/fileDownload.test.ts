import { draftToEspace } from "@/lib/publishedGents";
import {
  downloadableDocumentsFromDraft,
  isValidDownloadEmail,
  pdfFileName,
  validateDownloadLeadForm,
} from "@/lib/fileDownload";
import { textToPdfBytes, wrapPdfText } from "@/lib/textToPdf";
import type { GentDraft } from "@/lib/types/builder";

function draft(partial: Partial<GentDraft> = {}): GentDraft {
  return {
    id: "g1",
    name: "Assistant document",
    icon: "📄",
    objective: "Comprendre un document",
    systemPrompt: "Tu aides à comprendre le document.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    ...partial,
  };
}

describe("downloadableDocumentsFromDraft", () => {
  it("retient les fichiers dont le texte a été lu", () => {
    const docs = downloadableDocumentsFromDraft(
      draft({
        knowledgeSources: [
          { id: "k1", kind: "file", label: "livre.pdf", meta: "1 Mo", text: "Chapitre 1" },
          { id: "k2", kind: "url", label: "https://exemple.fr", meta: "lien" },
        ],
      })
    );
    expect(docs).toHaveLength(1);
    expect(docs[0]).toEqual({ id: "k1", name: "livre.pdf", text: "Chapitre 1" });
  });

  it("ajoute le document d'une visionneuse s'il n'est pas déjà listé", () => {
    const docs = downloadableDocumentsFromDraft(
      draft({
        visionneuse: {
          enabled: true,
          document: {
            sourceName: "rapport.docx",
            sourceKind: "docx",
            pageCount: 2,
            pages: ["Page A", "Page B"],
            toc: [],
            truncated: false,
          },
        },
      })
    );
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("rapport.docx");
    expect(docs[0].text).toContain("Page A");
    expect(docs[0].text).toContain("Page B");
  });
});

describe("draftToEspace — téléchargement", () => {
  it("n'expose rien si la tuile est éteinte", () => {
    const espace = draftToEspace(
      draft({
        fileDownloadEnabled: false,
        fileDownloadFormEnabled: true,
        knowledgeSources: [{ id: "k1", kind: "file", label: "doc.pdf", meta: "1 Mo", text: "Hello" }],
      })
    );
    expect(espace.fileDownloadEnabled).toBeUndefined();
    expect(espace.fileDownloadFormEnabled).toBeUndefined();
    expect(espace.downloadableDocuments).toBeUndefined();
  });

  it("copie le document et le formulaire quand la tuile est allumée", () => {
    const espace = draftToEspace(
      draft({
        fileDownloadEnabled: true,
        fileDownloadFormEnabled: true,
        knowledgeSources: [{ id: "k1", kind: "file", label: "doc.pdf", meta: "1 Mo", text: "Hello" }],
      })
    );
    expect(espace.fileDownloadEnabled).toBe(true);
    expect(espace.fileDownloadFormEnabled).toBe(true);
    expect(espace.downloadableDocuments?.[0].text).toBe("Hello");
  });

  it("autorise le PDF sans formulaire si la sous-option est éteinte", () => {
    const espace = draftToEspace(
      draft({
        fileDownloadEnabled: true,
        fileDownloadFormEnabled: false,
        knowledgeSources: [{ id: "k1", kind: "file", label: "doc.pdf", meta: "1 Mo", text: "Hello" }],
      })
    );
    expect(espace.fileDownloadEnabled).toBe(true);
    expect(espace.fileDownloadFormEnabled).toBeUndefined();
    expect(espace.downloadableDocuments).toHaveLength(1);
  });
});

describe("formulaire de téléchargement", () => {
  const valid = {
    firstName: "Camille",
    lastName: "Dupont",
    email: "camille@exemple.fr",
    notARobot: true,
    honeypot: "",
  };

  it("accepte un formulaire complet", () => {
    expect(validateDownloadLeadForm(valid)).toBeNull();
  });

  it("refuse un e-mail invalide", () => {
    expect(isValidDownloadEmail("pas-un-mail")).toBe(false);
    expect(validateDownloadLeadForm({ ...valid, email: "pas-un-mail" })).toBe("invalid-email");
  });

  it("exige la case « Vous n’êtes pas un robot »", () => {
    expect(validateDownloadLeadForm({ ...valid, notARobot: false })).toBe("captcha");
  });

  it("détecte le champ piège sans le traiter comme une saisie honnête", () => {
    expect(validateDownloadLeadForm({ ...valid, honeypot: "http://spam.test" })).toBe("honeypot");
  });
});

describe("pdfFileName", () => {
  it("remplace l'extension d'origine par .pdf", () => {
    expect(pdfFileName("LIVRE BLANC.docx")).toBe("LIVRE BLANC.pdf");
    expect(pdfFileName("notes")).toBe("notes.pdf");
  });
});

describe("textToPdfBytes", () => {
  it("produit un PDF avec en-tête et accents français", () => {
    const bytes = textToPdfBytes("Titre", "Café, façade, œuf.");
    const header = Buffer.from(bytes.slice(0, 8)).toString("latin1");
    const tail = Buffer.from(bytes.slice(-5)).toString("latin1");
    expect(header).toBe("%PDF-1.4");
    expect(tail).toBe("%%EOF");
    expect(wrapPdfText("un deux trois").join(" ")).toContain("un deux trois");
  });
});
