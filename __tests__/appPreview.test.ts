import { extractAppPreviewSignal, mergeAppPreview, type AppPreviewSpec } from "@/lib/appPreview";

function signal(json: unknown): string {
  return `Voici l'aperçu.\n<!--APERCU: ${JSON.stringify(json)}-->`;
}

const MINIMAL = {
  appName: "Radar emploi",
  themes: ["Mon profil", "Postes"],
  modules: [
    {
      id: "mini-cv",
      title: "Mon mini CV",
      theme: "Mon profil",
      size: "large",
      blocks: [{ kind: "text", text: "Cheffe de projet, 6 ans d'expérience." }],
    },
  ],
};

describe("extractAppPreviewSignal", () => {
  it("retire le bloc du texte visible et rend l'aperçu", () => {
    const { text, preview, replace } = extractAppPreviewSignal(signal(MINIMAL));
    expect(text).toBe("Voici l'aperçu.");
    expect(replace).toBe(false);
    expect(preview?.appName).toBe("Radar emploi");
    expect(preview?.modules).toHaveLength(1);
    expect(preview?.modules[0].id).toBe("mini-cv");
  });

  it("laisse le texte intact quand il n'y a pas de bloc", () => {
    const { text, preview } = extractAppPreviewSignal("Réponse sans aperçu.");
    expect(text).toBe("Réponse sans aperçu.");
    expect(preview).toBeNull();
  });

  it("ignore un bloc malformé sans casser la réponse", () => {
    const { text, preview } = extractAppPreviewSignal("Texte.\n<!--APERCU: {oops-->");
    expect(preview).toBeNull();
    expect(text).toContain("Texte.");
  });

  it("écarte les blocs inconnus et les modules qui n'en gardent aucun", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue"],
        modules: [
          { id: "vide", title: "Module vide", theme: "Vue", size: "standard", blocks: [{ kind: "iframe", src: "http://x" }] },
          {
            id: "ok",
            title: "Module valide",
            theme: "Vue",
            size: "standard",
            blocks: [
              { kind: "iframe", src: "http://x" },
              { kind: "stats", items: [{ value: "12", label: "Offres" }] },
            ],
          },
        ],
      })
    );
    expect(preview?.modules.map((m) => m.id)).toEqual(["ok"]);
    expect(preview?.modules[0].blocks).toHaveLength(1);
  });

  it("rattache un module rangé dans un onglet non déclaré", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue d'ensemble"],
        modules: [
          {
            id: "orphelin",
            title: "Orphelin",
            theme: "Onglet fantôme",
            size: "standard",
            blocks: [{ kind: "text", text: "Contenu." }],
          },
        ],
      })
    );
    expect(preview?.themes).toContain(preview?.modules[0].theme);
  });

  it("normalise une taille invalide et fabrique un id depuis le titre", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue"],
        modules: [{ title: "Dépenses à surveiller", theme: "Vue", size: "gigantesque", blocks: [{ kind: "text", text: "…" }] }],
      })
    );
    expect(preview?.modules[0].size).toBe("standard");
    expect(preview?.modules[0].id).toBe("depenses-a-surveiller");
  });
});

describe("mergeAppPreview", () => {
  const current: AppPreviewSpec = {
    themes: ["A", "B"],
    modules: [
      { id: "m1", title: "Un", theme: "A", size: "standard", blocks: [{ kind: "text", text: "un" }] },
      { id: "m2", title: "Deux", theme: "B", size: "standard", blocks: [{ kind: "text", text: "deux" }] },
    ],
  };

  it("remplace un module de même id sans le déplacer", () => {
    const incoming: AppPreviewSpec = {
      themes: ["A"],
      modules: [{ id: "m1", title: "Un (v2)", theme: "A", size: "large", blocks: [{ kind: "text", text: "maj" }] }],
    };
    const merged = mergeAppPreview(current, incoming, false);
    expect(merged.modules.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(merged.modules[0].title).toBe("Un (v2)");
  });

  it("ajoute un module nouveau et son onglet", () => {
    const incoming: AppPreviewSpec = {
      themes: ["C"],
      modules: [{ id: "m3", title: "Trois", theme: "C", size: "compact", blocks: [{ kind: "text", text: "trois" }] }],
    };
    const merged = mergeAppPreview(current, incoming, false);
    expect(merged.modules).toHaveLength(3);
    expect(merged.themes).toEqual(["A", "B", "C"]);
  });

  it("repart de zéro quand replace est demandé", () => {
    const incoming: AppPreviewSpec = {
      themes: ["Z"],
      modules: [{ id: "z", title: "Zéro", theme: "Z", size: "full", blocks: [{ kind: "text", text: "z" }] }],
    };
    expect(mergeAppPreview(current, incoming, true).modules.map((m) => m.id)).toEqual(["z"]);
  });

  it("oublie les onglets qui ne portent plus aucun module", () => {
    const merged = mergeAppPreview(
      { themes: ["A", "Vide"], modules: current.modules },
      { themes: [], modules: [] },
      false
    );
    expect(merged.themes).toEqual(["A", "B"]);
  });
});
