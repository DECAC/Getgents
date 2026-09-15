import { correspond, termesDeRecherche } from "@/lib/rechercheModele";

// Tel qu'OpenRouter le renvoie sur une cle personnelle.
const flash = {
  id: "google/gemini-2.5-flash",
  label: "Google: Gemini 2.5 Flash",
  provider: "Google",
};
const sonnet = {
  id: "anthropic/claude-sonnet-5",
  label: "Claude Sonnet 5",
  provider: "Anthropic",
};

describe("recherche dans le catalogue de modeles", () => {
  it("trouve malgre un mot intercale — le defaut signale", () => {
    // « Gemini 2.5 Flash » : « gemini flash » n'est pas contigu.
    expect(correspond(flash, "gemini flash")).toBe(true);
  });

  it("trouve par identifiant, que le createur recopie", () => {
    expect(correspond(flash, "google/gemini-2.5-flash")).toBe(true);
  });

  it("traite les separateurs d'identifiant comme des espaces", () => {
    expect(correspond(flash, "google gemini")).toBe(true);
  });

  it("ignore la casse et les accents", () => {
    expect(correspond(sonnet, "ANTHROPIC")).toBe(true);
  });

  it("exige TOUS les termes", () => {
    expect(correspond(flash, "gemini anthropic")).toBe(false);
  });

  it("ne confond pas deux modeles", () => {
    expect(correspond(sonnet, "gemini")).toBe(false);
  });

  it("une requete vide laisse tout passer", () => {
    expect(correspond(flash, "   ")).toBe(true);
    expect(termesDeRecherche("  ")).toEqual([]);
  });
});
