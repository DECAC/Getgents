import { extractProfileSignal, parseProfile, profileContextNote } from "@/lib/profileSignal";

describe("parseProfile", () => {
  it("valide un profil complet et borne les listes", () => {
    const p = parseProfile({
      metier: "Product Manager",
      seniorite: "Senior (8 ans)",
      competences: ["discovery", "SQL", "IA générative"],
      localisation: "Rennes",
      mobilite: "hybride, 2j remote",
      salaireCible: "65-75 k€",
      typesContrat: ["CDI"],
      secteurs: ["SaaS", "fintech"],
      exclusions: ["défense"],
      resume: "PM senior orienté data à Rennes.",
    });
    expect(p).not.toBeNull();
    expect(p!.metier).toBe("Product Manager");
    expect(p!.competences).toHaveLength(3);
  });

  it("rejette un profil sans métier", () => {
    expect(parseProfile({ seniorite: "junior" })).toBeNull();
    expect(parseProfile({ metier: "  " })).toBeNull();
  });

  it("ignore les champs invalides sans rejeter le profil", () => {
    const p = parseProfile({ metier: "Dev", competences: "pas une liste", secteurs: [42, "web"] });
    expect(p!.competences).toBeUndefined();
    expect(p!.secteurs).toEqual(["web"]);
  });
});

describe("extractProfileSignal", () => {
  it("extrait le bloc et nettoie le texte", () => {
    const raw = 'Voici votre profil.\n\n<!--PROFILE: {"metier":"Data Analyst","localisation":"Lyon"}-->';
    const { text, profile } = extractProfileSignal(raw);
    expect(text).toBe("Voici votre profil.");
    expect(profile).toMatchObject({ metier: "Data Analyst", localisation: "Lyon" });
  });

  it("renvoie null sur JSON invalide sans casser le texte", () => {
    const { text, profile } = extractProfileSignal("Réponse.\n<!--PROFILE: {pas du json}-->");
    expect(profile).toBeNull();
    expect(text).toBe("Réponse.");
  });

  it("ne matche rien sans bloc", () => {
    const { text, profile } = extractProfileSignal("Simple réponse.");
    expect(profile).toBeNull();
    expect(text).toBe("Simple réponse.");
  });
});

describe("profileContextNote", () => {
  it("liste uniquement les champs renseignés", () => {
    const note = profileContextNote({ metier: "Dev", localisation: "Nantes" });
    expect(note).toContain("Dev");
    expect(note).toContain("Nantes");
    expect(note).not.toContain("Salaire");
  });
});
