import {
  parseStarters,
  shouldShowStarters,
  shouldShowConversationStarters,
  activeConversationMessageCount,
  describeGentForStarters,
  fallbackStarters,
  displayedStarters,
  STARTER_COUNT,
} from "@/lib/starterSignal";
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

  it("reste affiché sur l'ancien canevas même si un aperçu d'application existe", () => {
    // shouldShowStarters ne regarde que les artefacts : c'est
    // shouldShowConversationStarters qui gère le cas aperçu + conversation.
    expect(
      shouldShowStarters(
        espace({
          appPreview: { themes: ["Profil"], modules: [{ id: "cv", title: "CV", theme: "Profil", size: "large", blocks: [{ kind: "text", text: "x" }] }] },
        }),
        0
      )
    ).toBe(true);
  });
});

describe("amorces à l'ouverture de la conversation (aperçu d'application)", () => {
  const preview = {
    themes: ["Mon profil", "Réseau"],
    modules: [
      { id: "cv", title: "Mini CV", theme: "Mon profil", size: "large" as const, blocks: [{ kind: "text" as const, text: "x" }] },
    ],
  };

  it("s'affiche quand l'aperçu remplit le canevas et que le fil est vide", () => {
    expect(shouldShowConversationStarters(espace({ appPreview: preview }), 0)).toBe(true);
  });

  it("disparaît dès le premier message", () => {
    expect(shouldShowConversationStarters(espace({ appPreview: preview }), 1)).toBe(false);
  });

  it("ne s'affiche pas sans aperçu d'application (l'ancien canevas s'en charge)", () => {
    expect(shouldShowConversationStarters(espace({}), 0)).toBe(false);
  });

  it("ne s'affiche pas en mini-application ni avec un formulaire jump", () => {
    expect(
      shouldShowConversationStarters(
        espace({
          appPreview: preview,
          pinnedArtefact: { enabled: true, title: "T", mission: "M", inputs: [] },
        }),
        0
      )
    ).toBe(false);
    expect(
      shouldShowConversationStarters(
        espace({
          appPreview: preview,
          jumpForm: { title: "Lancer", fields: [] },
        }),
        0
      )
    ).toBe(false);
  });

  it("compte les messages du fil actif", () => {
    expect(
      activeConversationMessageCount(
        espace({
          conversations: [
            { id: "c1", startedAt: "hier", messages: [] },
            { id: "c2", startedAt: "aujourd'hui", messages: [{ role: "user", text: "bonjour" }] },
          ],
          activeConversationId: "c2",
        })
      )
    ).toBe(1);
    expect(activeConversationMessageCount(espace({ conversations: [], activeConversationId: "x" }))).toBe(0);
  });
});

describe("repli d'accueil tant que le gent n'a pas choisi ses déclencheurs", () => {
  it("s'appuie sur les onglets et modules de l'aperçu", () => {
    const out = fallbackStarters(
      espace({
        gent: "Radar emploi",
        appPreview: {
          themes: ["Mon profil", "Réseau"],
          modules: [{ id: "cv", title: "Mini CV", theme: "Mon profil", size: "large", blocks: [{ kind: "text", text: "x" }] }],
        },
      })
    );
    expect(out.length).toBe(STARTER_COUNT);
    expect(out[0]).toContain("Mon profil");
    expect(out.some((q) => q.includes("Réseau"))).toBe(true);
    expect(out.some((q) => q.includes("Mini CV"))).toBe(true);
  });

  it("reste utilisable sans aperçu, à partir du nom du gent", () => {
    const out = fallbackStarters(espace({ gent: "Compagnon de voyage" }));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toContain("Compagnon de voyage");
  });

  it("préfère les déclencheurs persistés au repli", () => {
    expect(displayedStarters(espace({ starters: ["Question A", "Question B"] }))).toEqual([
      "Question A",
      "Question B",
    ]);
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

  it("mentionne les onglets de l'aperçu d'application", () => {
    const described = describeGentForStarters(
      espace({
        gent: "Radar emploi",
        appPreview: {
          themes: ["Mon profil", "Réseau"],
          modules: [
            { id: "cv", title: "Mini CV", theme: "Mon profil", size: "large", blocks: [{ kind: "text", text: "x" }] },
          ],
        },
      })
    );
    expect(described).toContain("Mon profil");
    expect(described).toContain("Mini CV");
  });

  it("borne le prompt système, qui embarque la base de connaissance entière", () => {
    const described = describeGentForStarters(espace({ systemPrompt: "x".repeat(20_000) }));
    expect(described.length).toBeLessThan(6000);
  });
});
