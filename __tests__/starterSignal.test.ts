import { parseStarters, shouldShowStarters, describeGentForStarters, STARTER_COUNT } from "@/lib/starterSignal";
import type { Espace } from "@/lib/types";

function espace(partial: Partial<Espace>): Espace {
  return {
    icon: "✨",
    name: "Test",
    gent: "Test",
    version: 1,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "",
    conversations: [],
    activeConversationId: "c1",
    files: [],
    artefacts: [],
    ...partial,
  } as Espace;
}

describe("extraction des déclencheurs", () => {
  it("lit un tableau JSON nu", () => {
    const out = parseStarters('["Question A","Question B"]');
    expect(out).toEqual(["Question A", "Question B"]);
  });

  it("tolère une phrase d'introduction avant le JSON", () => {
    const out = parseStarters('Voici les questions :\n["Question A","Question B"]');
    expect(out).toEqual(["Question A", "Question B"]);
  });

  it("tolère un bloc de code balisé", () => {
    const out = parseStarters('```json\n["Question A","Question B"]\n```');
    expect(out).toEqual(["Question A", "Question B"]);
  });

  it("tolère un objet { questions: [...] }", () => {
    const out = parseStarters('{"questions":["Question A","Question B"]}');
    expect(out).toEqual(["Question A", "Question B"]);
  });

  it("tolère des objets { question } au lieu de chaînes", () => {
    const out = parseStarters('[{"question":"Question A"},{"question":"Question B"}]');
    expect(out).toEqual(["Question A", "Question B"]);
  });

  it("déduplique sans tenir compte de la casse", () => {
    const out = parseStarters('["Même question","MÊME QUESTION","Autre"]');
    expect(out).toEqual(["Même question", "Autre"]);
  });

  it(`ne renvoie jamais plus de ${STARTER_COUNT} questions`, () => {
    const many = JSON.stringify(Array.from({ length: 12 }, (_, i) => `Question ${i}`));
    expect(parseStarters(many)).toHaveLength(STARTER_COUNT);
  });

  it("normalise les espaces et borne la longueur", () => {
    const long = `["${"a".repeat(400)}"]`;
    expect(parseStarters(long)[0].length).toBeLessThanOrEqual(110);
    expect(parseStarters('["Deux   espaces\\n\\nici"]')).toEqual(["Deux espaces ici"]);
  });

  it("renvoie une liste vide plutôt que de deviner sur une sortie inexploitable", () => {
    expect(parseStarters("Je ne peux pas répondre.")).toEqual([]);
    expect(parseStarters("")).toEqual([]);
    expect(parseStarters("[1, 2, 3]")).toEqual([]);
  });
});

describe("affichage des déclencheurs", () => {
  it("s'affiche sur un espace conversationnel vierge", () => {
    expect(shouldShowStarters(espace({}), 0)).toBe(true);
  });

  it("disparaît dès que l'espace contient un module", () => {
    expect(shouldShowStarters(espace({}), 1)).toBe(false);
  });

  it("ne s'affiche jamais en mode mini-application", () => {
    // Une mini-app ne converse pas : des amorces de conversation n'y mènent
    // nulle part, et openAssistant est de toute façon verrouillé.
    const miniApp = espace({
      pinnedArtefact: { enabled: true, title: "T", mission: "M", inputs: [] },
    });
    expect(shouldShowStarters(miniApp, 0)).toBe(false);
  });
});

describe("description du gent transmise au modèle", () => {
  it("énumère les capacités réellement actives", () => {
    const described = describeGentForStarters(
      espace({
        gent: "Compagnon Immobilier",
        webSearch: true,
        datasets: [{ name: "DVF", url: "https://example.org" }],
        prim: true,
      })
    );
    expect(described).toContain("Compagnon Immobilier");
    expect(described).toContain("recherche web");
    expect(described).toContain("DVF");
    expect(described).toContain("PRIM");
  });

  it("n'annonce pas de capacité absente", () => {
    const described = describeGentForStarters(espace({ gent: "Simple" }));
    expect(described).not.toContain("recherche web");
    expect(described).not.toContain("Powens");
  });

  it("borne le prompt système, qui embarque la base de connaissance entière", () => {
    const described = describeGentForStarters(espace({ systemPrompt: "x".repeat(20_000) }));
    expect(described.length).toBeLessThan(6000);
  });
});
