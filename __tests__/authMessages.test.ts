import {
  destinationApresConnexion,
  messageErreurAuth,
  verifierMotDePasse,
} from "@/lib/authMessages";

describe("messages d'erreur", () => {
  it("traduit sans révéler si le compte existe", () => {
    // Distinguer « mot de passe faux » de « compte inconnu » offrirait un
    // oracle d'énumération des adresses inscrites.
    expect(messageErreurAuth("Invalid login credentials")).toBe(
      "Adresse e-mail ou mot de passe incorrect."
    );
  });

  it("ne confirme pas qu'une adresse est deja inscrite", () => {
    const msg = messageErreurAuth("User already registered");
    expect(msg).toContain("Si cette adresse");
    expect(msg.toLowerCase()).not.toContain("déjà");
    expect(msg.toLowerCase()).not.toContain("existe");
  });

  it("oriente vers l'action à faire", () => {
    expect(messageErreurAuth("Email not confirmed")).toContain("confirmée");
    expect(messageErreurAuth("Token has expired")).toContain("nouveau");
    expect(messageErreurAuth("rate limit exceeded")).toContain("Patientez");
  });

  it("ne renvoie jamais de message vide", () => {
    expect(messageErreurAuth(undefined).length).toBeGreaterThan(10);
    expect(messageErreurAuth("").length).toBeGreaterThan(10);
    expect(messageErreurAuth("   ").length).toBeGreaterThan(10);
  });
});

describe("règles de mot de passe", () => {
  it("exige huit caractères", () => {
    expect(verifierMotDePasse("court")).toContain("trop court");
    expect(verifierMotDePasse("assezlong")).toBeNull();
  });

  it("vérifie la confirmation quand elle est demandée", () => {
    expect(verifierMotDePasse("assezlong", "assezlong")).toBeNull();
    expect(verifierMotDePasse("assezlong", "autrechose")).toContain("ne correspondent pas");
  });
});

describe("destination après connexion", () => {
  it("revient là où l'on voulait aller", () => {
    expect(destinationApresConnexion("/builder/g-42")).toBe("/builder/g-42");
    expect(destinationApresConnexion("/espace/voyage?x=1")).toBe("/espace/voyage?x=1");
  });

  it("refuse une redirection vers l'extérieur", () => {
    // Sinon /connexion?next=https://faux-site devient un hameçonnage qui
    // commence sur le vrai domaine.
    for (const hostile of [
      "https://site-hostile.fr",
      "//site-hostile.fr",
      "http://site-hostile.fr",
      "javascript:alert(1)",
    ]) {
      expect(destinationApresConnexion(hostile)).toBe("/builder/mesgents");
    }
  });

  it("a une destination par défaut", () => {
    expect(destinationApresConnexion(null)).toBe("/builder/mesgents");
    expect(destinationApresConnexion("")).toBe("/builder/mesgents");
  });
});
