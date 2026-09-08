import { draftToEspace } from "@/lib/publishedGents";
import {
  downloadableDocumentsForReader,
  downloadableDocumentsFromDraft,
  documentsSelectionnes,
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

describe("downloadableDocumentsForReader", () => {
  it("retombe sur le document de visionneuse si la liste diffusée est vide", () => {
    const docs = downloadableDocumentsForReader({
      fileDownloadEnabled: true,
      downloadableDocuments: [],
      artefacts: [
        {
          id: "visionneuse-doc",
          title: "Livre blanc",
          type: "Visionneuse de document",
          icon: "📖",
          date: "Document du gent",
          document: {
            sourceName: "livre-blanc.pdf",
            sourceKind: "pdf",
            pageCount: 1,
            pages: ["Chapitre IA"],
            toc: [],
            truncated: false,
          },
        },
      ],
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("livre-blanc.pdf");
    expect(docs[0].text).toContain("Chapitre IA");
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
    turnstileToken: "ok",
    honeypot: "",
  };

  it("accepte un formulaire complet", () => {
    expect(validateDownloadLeadForm(valid)).toBeNull();
  });

  it("refuse un e-mail invalide", () => {
    expect(isValidDownloadEmail("pas-un-mail")).toBe(false);
    expect(validateDownloadLeadForm({ ...valid, email: "pas-un-mail" })).toBe("invalid-email");
  });

  it("exige le jeton captcha", () => {
    expect(validateDownloadLeadForm({ ...valid, turnstileToken: "" })).toBe("captcha");
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

describe("documentsSelectionnes", () => {
  const docs = [
    { id: "a", name: "Guide.pdf", text: "un" },
    { id: "b", name: "Annexe.docx", text: "deux" },
    { id: "c", name: "Tarifs.xlsx", text: "trois" },
  ];

  it("rend tout quand aucune sélection n'a été faite", () => {
    // Le comportement d'avant la fonctionnalité. Un gent déjà diffusé ne doit
    // pas se mettre à offrir moins parce qu'on a ajouté un réglage.
    expect(documentsSelectionnes(docs, undefined)).toHaveLength(3);
  });

  it("ne rend rien sur une sélection vide", () => {
    // Distinct de `undefined` : c'est un choix explicite du créateur.
    expect(documentsSelectionnes(docs, [])).toEqual([]);
  });

  it("ne rend que les documents cochés", () => {
    expect(documentsSelectionnes(docs, ["a", "c"]).map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("garde l'ordre des documents, pas celui de la sélection", () => {
    // Le créateur range ses connaissances ; le lecteur doit les retrouver
    // dans cet ordre, quel que soit l'ordre des clics.
    expect(documentsSelectionnes(docs, ["c", "a"]).map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("ignore un identifiant qui ne correspond plus à rien", () => {
    // Cas réel : un document retiré des connaissances après avoir été coché.
    expect(documentsSelectionnes(docs, ["a", "disparu"]).map((d) => d.id)).toEqual(["a"]);
  });

  it("ne duplique pas un document coché deux fois", () => {
    expect(documentsSelectionnes(docs, ["a", "a"])).toHaveLength(1);
  });
});

describe("downloadableDocumentsFromDraft avec sélection", () => {
  const draft = {
    knowledgeSources: [
      { id: "k1", label: "Guide.pdf", text: "contenu un" },
      { id: "k2", label: "Annexe.docx", text: "contenu deux" },
    ],
  } as unknown as Parameters<typeof downloadableDocumentsFromDraft>[0];

  it("propose tout sans sélection", () => {
    expect(downloadableDocumentsFromDraft(draft)).toHaveLength(2);
  });

  it("n'expose que ce qui est coché", () => {
    // La garantie qui compte : un document non coché ne doit atteindre ni
    // l'espace publié, ni le lecteur.
    const restreint = { ...draft, fileDownloadSelection: ["k2"] };
    expect(downloadableDocumentsFromDraft(restreint).map((d) => d.name)).toEqual(["Annexe.docx"]);
  });

  it("n'expose rien quand la sélection est vide", () => {
    const aucun = { ...draft, fileDownloadSelection: [] };
    expect(downloadableDocumentsFromDraft(aucun)).toEqual([]);
  });
});
