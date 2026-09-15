import { sousTitreDuGent } from "@/lib/enteteGent";

describe("sous-titre de l'en-tete d'un gent", () => {
  it("tait le doublon exact", () => {
    expect(sousTitreDuGent("Talk to Charles from LinkedIn", "Talk to Charles from LinkedIn")).toBeNull();
  });

  it("tait le doublon a la casse, aux accents et aux espaces pres", () => {
    expect(sousTitreDuGent("Compagnon Immobilier", "  compagnon  immobilier ")).toBeNull();
    expect(sousTitreDuGent("Événement", "evenement")).toBeNull();
  });

  it("garde un sous-titre qui apprend quelque chose", () => {
    expect(sousTitreDuGent("Talk to Charles", "Avatar conversationnel de Charles")).toBe(
      "Avatar conversationnel de Charles"
    );
  });

  it("rend null quand il n'y a rien a dire", () => {
    expect(sousTitreDuGent("Titre", "")).toBeNull();
    expect(sousTitreDuGent("Titre", "   ")).toBeNull();
    expect(sousTitreDuGent("Titre", null)).toBeNull();
  });

  it("garde le sous-titre quand le titre manque", () => {
    expect(sousTitreDuGent("", "Un nom")).toBe("Un nom");
    expect(sousTitreDuGent(undefined, "Un nom")).toBe("Un nom");
  });
});
