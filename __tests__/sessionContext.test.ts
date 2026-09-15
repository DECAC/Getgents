import { FILES_CONTEXT_BUDGET, documentsBudgetFor, filesNote, memoryNote, sessionContextNote } from "@/lib/sessionContext";
import { espaceForPinnedRefresh, espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { Espace, UserFile } from "@/lib/types";

const file = (name: string, text?: string, truncated = false): UserFile => ({
  id: name,
  name,
  size: "12 Ko",
  date: "à l'instant",
  text,
  truncated,
});

describe("mémoire", () => {
  it("est omise quand elle est vide", () => {
    expect(memoryNote("")).toBe("");
    expect(memoryNote("   ")).toBe("");
    expect(memoryNote(undefined)).toBe("");
  });

  it("est reprise telle quelle sinon", () => {
    expect(memoryNote("Préfère les trajets en train")).toContain("Préfère les trajets en train");
  });
});

describe("documents de la session", () => {
  it("ignore les fichiers sans contenu extrait (entrées décoratives)", () => {
    expect(filesNote([file("ancien.pdf")])).toBe("");
  });

  it("inclut le contenu et le nom des documents", () => {
    const note = filesNote([file("cv.pdf", "Charles, 15 ans d'expérience")]);
    expect(note).toContain("cv.pdf");
    expect(note).toContain("Charles, 15 ans d'expérience");
  });

  it("signale une extraction tronquée", () => {
    expect(filesNote([file("gros.csv", "a,b,c", true)])).toContain("tronqué");
  });

  it("respecte le budget et nomme ce qui est écarté", () => {
    const gros = "x".repeat(FILES_CONTEXT_BUDGET - 10);
    const note = filesNote([file("premier.txt", gros), file("second.txt", "y".repeat(500))]);
    expect(note).toContain("premier.txt");
    expect(note).toContain("Non inclus faute de place");
    expect(note).toContain("second.txt");
    expect(note).not.toContain("y".repeat(500));
  });

  it("tronque un document plus gros que le budget au lieu de l'écarter", () => {
    // Comportement d'origine : le document était annoncé « trop volumineux » et
    // le gent répondait sans en avoir lu une ligne. Un livre blanc doit arriver
    // amputé, jamais absent.
    const note = filesNote([file("enorme.csv", "z".repeat(FILES_CONTEXT_BUDGET + 50_000))]);
    expect(note).toContain("enorme.csv");
    expect(note).toContain("zzzz");
    expect(note).toContain("document long");
    expect(note).toContain("n'invente jamais le contenu manquant");
  });
});

describe("documents volumineux (une centaine de pages)", () => {
  // ~2 800 caractères par page, comme la pagination de la visionneuse.
  const PAGE = 2_800;
  const hundredPages = "Le contenu du livre blanc. ".repeat(Math.ceil((100 * PAGE) / 27));

  it("fait tenir un document de 100 pages en entier, sans troncature", () => {
    const note = filesNote([file("livre-blanc.docx", hundredPages)], documentsBudgetFor("anthropic/claude-sonnet-5"));
    expect(note).not.toContain("document long");
    expect(note).not.toContain("Non inclus faute de place");
  });

  it("le fait tenir aussi sur le modèle à la plus petite fenêtre du catalogue", () => {
    const budget = documentsBudgetFor("mistralai/mistral-large");
    expect(budget).toBeGreaterThanOrEqual(100 * PAGE * 0.9);
  });

  it("dimensionne le budget sur la fenêtre de contexte du modèle", () => {
    expect(documentsBudgetFor("anthropic/claude-sonnet-5")).toBeGreaterThan(documentsBudgetFor("mistralai/mistral-large"));
    // Modèle inconnu : on retombe sur la plus petite fenêtre, jamais sur zéro.
    expect(documentsBudgetFor("modele/inexistant")).toBe(documentsBudgetFor("mistralai/mistral-large"));
  });
});

describe("contexte partagé par les deux modes", () => {
  const espace = { memory: "Note importante", files: [file("cv.pdf", "Parcours détaillé")] };

  it("réunit mémoire et documents", () => {
    const note = sessionContextNote(espace as Pick<Espace, "memory" | "files">);
    expect(note).toContain("Note importante");
    expect(note).toContain("Parcours détaillé");
  });
});

describe("transport vers la génération de l'artefact figé", () => {
  const espace = {
    icon: "🧭",
    name: "Next Move",
    gent: "Next Move",
    version: 1,
    status: "active",
    statusLabel: "Publié",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "Mémoire à conserver",
    conversations: [],
    activeConversationId: "local",
    files: [file("cv.pdf", "Parcours"), file("decoratif.pdf")],
    artefacts: [],
    systemPrompt: "prompt",
    pinnedArtefact: { enabled: true, title: "T", mission: "M", inputs: [] },
  } as unknown as Espace;

  it("emporte la mémoire et les documents porteurs de contenu", () => {
    const slim = espaceForPinnedRefresh(espace);
    expect(slim.memory).toBe("Mémoire à conserver");
    expect(slim.files.map((f) => f.name)).toEqual(["cv.pdf"]);
  });

  it("ne les expose jamais au destinataire d'un lien de partage", () => {
    const pub = espaceForPublicLink(espace);
    expect(pub.memory).toBe("");
    expect(pub.files).toEqual([]);
    expect(JSON.stringify(pub)).not.toContain("Parcours");
    expect(JSON.stringify(pub)).not.toContain("Mémoire à conserver");
  });
});
