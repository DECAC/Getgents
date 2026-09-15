import {
  MESSAGE_NOM_INVALIDE,
  NOM_AFFICHE_MAX,
  attributionPublique,
  nomAfficheValide,
  normaliserNomAffiche,
} from "@/lib/nomAffiche";

describe("normaliserNomAffiche", () => {
  it("écrase les espaces et les retours à la ligne", () => {
    // Le nom est rendu sur une seule ligne : un saut de ligne casserait la
    // mise en page sans que son auteur comprenne pourquoi.
    expect(normaliserNomAffiche("  Charles\n  de Cassan  ")).toBe("Charles de Cassan");
  });

  it("borne la longueur", () => {
    expect(normaliserNomAffiche("a".repeat(200))).toHaveLength(NOM_AFFICHE_MAX);
  });

  it("survit à autre chose qu'une chaîne", () => {
    // La valeur vient des métadonnées du compte, donc du réseau.
    expect(normaliserNomAffiche(undefined)).toBe("");
    expect(normaliserNomAffiche(42)).toBe("");
    expect(normaliserNomAffiche(null)).toBe("");
  });
});

describe("nomAfficheValide", () => {
  it("accepte un nom ordinaire", () => {
    expect(nomAfficheValide("The G Company")).toBe(true);
    expect(nomAfficheValide("Gary Gentle")).toBe(true);
  });

  it("refuse une adresse e-mail", () => {
    // C'est l'erreur naturelle — le champ voisine celui de l'adresse — et la
    // publier exposerait le créateur aux robots sur une page indexée.
    expect(nomAfficheValide("ceo@getgents.ai")).toBe(false);
  });

  it("refuse un nom trop court", () => {
    expect(nomAfficheValide("G")).toBe(false);
    expect(nomAfficheValide("   ")).toBe(false);
  });

  it("le message d'erreur dit pourquoi, pas seulement que c'est refusé", () => {
    expect(MESSAGE_NOM_INVALIDE).toMatch(/visible de tous/i);
  });
});

describe("attributionPublique", () => {
  it("préfère le nom posé sur le gent", () => {
    // Un même créateur publie sous le nom de son entreprise ici, le sien là.
    expect(attributionPublique("The G Company", "Gary Gentle")).toBe("The G Company");
  });

  it("retombe sur le nom du compte", () => {
    expect(attributionPublique("", "Gary Gentle")).toBe("Gary Gentle");
    expect(attributionPublique(undefined, "Gary Gentle")).toBe("Gary Gentle");
    expect(attributionPublique("   ", "Gary Gentle")).toBe("Gary Gentle");
  });

  it("rend null quand il n'y a rien de présentable", () => {
    // « Propulsé par » suivi d'un vide serait pire que pas de ligne du tout.
    expect(attributionPublique(null, null)).toBeNull();
    expect(attributionPublique("", "")).toBeNull();
  });

  it("normalise ce qu'elle rend", () => {
    expect(attributionPublique("  The   G   Company ", null)).toBe("The G Company");
  });
});
