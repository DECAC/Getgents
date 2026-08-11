import { draftToEspace } from "@/lib/publishedGents";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import type { GentDraft } from "@/lib/types/builder";
import type { DocumentViewerSpec } from "@/lib/types";

/**
 * Un gent « visionneuse » doit pouvoir répondre sur le document que son lecteur
 * a sous les yeux — y compris quand il est DIFFUSÉ par lien. Les fichiers de
 * session appartiennent à l'utilisateur et sont retirés des espaces partagés :
 * le document du créateur passe donc par le prompt système.
 */
const PAGE_CHARS = 2_800;

function pages(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Contenu de la page ${i + 1}. `.repeat(Math.ceil(PAGE_CHARS / 26)));
}

function spec(pageCount: number): DocumentViewerSpec {
  return {
    sourceName: "livre-blanc.docx",
    sourceKind: "docx",
    pageCount,
    pages: pages(pageCount),
    toc: [{ id: "t0", title: "Introduction", level: 1, page: 0 }],
    truncated: false,
  };
}

function draft(document: DocumentViewerSpec, chatModelId = "anthropic/claude-sonnet-5"): GentDraft {
  return {
    id: "visionneuse-test",
    name: "Lecteur de livre blanc",
    icon: "📖",
    objective: "Accompagner la lecture",
    systemPrompt: "Tu accompagnes la lecture du livre blanc.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [{ capability: "chat", modelId: chatModelId }],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    visionneuse: { enabled: true, instructions: "Reste factuel.", document },
  } as unknown as GentDraft;
}

describe("gent visionneuse — accès du modèle au document", () => {
  it("injecte le texte intégral d'un document de 100 pages dans le prompt système", () => {
    const espace = draftToEspace(draft(spec(100)));
    expect(espace.systemPrompt).toContain("TEXTE INTÉGRAL DU DOCUMENT");
    expect(espace.systemPrompt).toContain("Contenu de la page 1.");
    expect(espace.systemPrompt).toContain("Contenu de la page 100.");
    expect(espace.systemPrompt).not.toContain("Le document continue au-delà");
  });

  it("pagine le texte pour que le gent situe ses réponses comme le lecteur", () => {
    const espace = draftToEspace(draft(spec(5)));
    expect(espace.systemPrompt).toContain("[Page 1]");
    expect(espace.systemPrompt).toContain("[Page 5]");
  });

  it("survit à la diffusion par lien de partage", () => {
    const espace = draftToEspace(draft(spec(100)));
    const shared = espaceForPublicLink(espace);
    // Le visiteur ne reçoit pas le prompt (il reste serveur), mais le prompt
    // assemblé côté serveur pour SA conversation doit contenir le document.
    const prompt = buildGentSystemPrompt(espace, { variant: "sharedLink" });
    expect(prompt).toContain("Contenu de la page 100.");
    // …et il reçoit bien le document à lire dans sa visionneuse.
    expect(shared.artefacts.find((a) => a.id === "visionneuse-doc")?.document?.pageCount).toBe(100);
  });

  it("ne double pas le document dans les fichiers de session (poids de requête)", () => {
    const espace = draftToEspace(draft(spec(100)));
    const listed = espace.files.find((f) => f.id === "visionneuse-doc-file");
    expect(listed?.name).toBe("livre-blanc.docx");
    expect(listed?.text).toBeUndefined();
  });

  it("annonce franchement la coupe quand le document dépasse la fenêtre du modèle", () => {
    // 300 pages ≈ 840 000 caractères : au-delà de tout budget du catalogue.
    const espace = draftToEspace(draft(spec(300), "mistralai/mistral-large"));
    expect(espace.systemPrompt).toContain("Contenu de la page 1.");
    expect(espace.systemPrompt).toContain("Le document continue au-delà");
    expect(espace.systemPrompt).toContain("dis-le franchement");
  });
});
