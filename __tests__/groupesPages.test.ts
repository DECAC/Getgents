import { cleInvite, invitesValides, inviteDeLaListe, lienWhatsApp, messageRelance, messageWhatsApp, INVITES_MAX } from "@/lib/groupesPages";

describe("liens de groupe", () => {
  it("la liste : un prénom par ligne, nettoyée, sans doublon, bornée", () => {
    expect(invitesValides("Marie\n  Paul \n\nmarie\nLéa, Karim; Thomas")).toEqual(["Marie", "Paul", "Léa", "Karim", "Thomas"]);
    expect(invitesValides(Array.from({ length: 80 }, (_, i) => `P${i}`))).toHaveLength(INVITES_MAX);
    expect(invitesValides(42)).toEqual([]);
  });
  it("un prénom se retrouve sans casse ni accents, jamais hors de la liste", () => {
    expect(cleInvite("Léa")).toBe(cleInvite("lea"));
    expect(inviteDeLaListe(["Léa", "Paul"], "LEA")).toBe("Léa");
    expect(inviteDeLaListe(["Léa", "Paul"], "Intrus")).toBeNull();
    expect(inviteDeLaListe(["Léa"], 3)).toBeNull();
  });
});

describe("WhatsApp", () => {
  it("le message nomme la personne, ou salue le groupe", () => {
    expect(messageWhatsApp({ prenom: "Marie", titre: "Week-end", lien: "https://x/p/1" })).toBe("Bonjour Marie, voici « Week-end » : https://x/p/1");
    expect(messageWhatsApp({ prenom: null, titre: "Week-end", lien: "L" })).toMatch(/^Bonjour à tous/);
  });
  it("la relance nomme ceux qui manquent", () => {
    expect(messageRelance({ titre: "W", lien: "L", attente: ["Marie", "Sophie", "Léa"] })).toContain("il manque encore Marie, Sophie et Léa");
  });
  it("ouvre wa.me avec le texte encodé, sans numéro (l'auteur choisit le contact)", () => {
    expect(lienWhatsApp("a & b ?")).toBe("https://wa.me/?text=a%20%26%20b%20%3F");
  });
});
