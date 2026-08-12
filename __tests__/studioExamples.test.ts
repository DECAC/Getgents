import {
  exampleTab,
  illustratedCapabilities,
  STUDIO_CAPABILITIES,
  STUDIO_CAPABILITY_LABEL,
  STUDIO_EXAMPLES,
} from "@/lib/studioExamples";

describe("STUDIO_EXAMPLES", () => {
  it("illustre toutes les capacités disponibles", () => {
    // L'accueil du studio est le seul endroit où un créateur découvre ce que la
    // plateforme sait faire : une capacité livrée mais absente des exemples est
    // une capacité invisible.
    expect(illustratedCapabilities()).toEqual(STUDIO_CAPABILITIES);
  });

  it("donne un identifiant unique à chaque exemple", () => {
    const ids = STUDIO_EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("décrit un rôle exploitable, pas un simple titre", () => {
    for (const example of STUDIO_EXAMPLES) {
      expect(example.prompt.length).toBeGreaterThan(40);
      expect(example.title.trim()).not.toHaveLength(0);
      expect(example.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("n'annonce que des capacités connues", () => {
    for (const example of STUDIO_EXAMPLES) {
      for (const capability of example.capabilities) {
        expect(STUDIO_CAPABILITY_LABEL[capability]).toBeTruthy();
      }
    }
  });
});

describe("exampleTab", () => {
  it("atterrit sur le gent conversationnel par défaut", () => {
    const conversational = STUDIO_EXAMPLES.find((e) => !e.tab);
    expect(conversational && exampleTab(conversational)).toBe("conversationnel");
  });

  it("respecte l'onglet déclaré par l'exemple", () => {
    const viewer = STUDIO_EXAMPLES.find((e) => e.tab === "visionneuse");
    expect(viewer && exampleTab(viewer)).toBe("visionneuse");
  });
});

describe("illustratedCapabilities", () => {
  it("dédoublonne et respecte l'ordre du catalogue", () => {
    const result = illustratedCapabilities([
      { id: "a", icon: "a", title: "A", prompt: "…", capabilities: ["diffusion", "connexion"] },
      { id: "b", icon: "b", title: "B", prompt: "…", capabilities: ["connexion"] },
    ]);
    expect(result).toEqual(["connexion", "diffusion"]);
  });
});
