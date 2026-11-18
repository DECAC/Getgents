import {
  INSCRIPTIONS_OUVERTES,
  ADRESSE_DEMANDE_ACCES,
  MESSAGE_ACCES_RESTREINT,
  lienDemandeAcces,
  libelleAppelAction,
} from "@/lib/inscriptions";

describe("accès restreint", () => {
  it("les inscriptions sont fermées", () => {
    // Ce test échouera le jour où l'on rouvrira — c'est voulu : il oblige à
    // relire ce fichier, et donc à ne pas oublier le réglage Supabase qui
    // ferme réellement la porte (voir l'en-tête de lib/inscriptions.ts).
    expect(INSCRIPTIONS_OUVERTES).toBe(false);
  });

  it("l'appel à l'action dit ce qu'il fait vraiment", () => {
    expect(libelleAppelAction()).toBe("Demander un accès");
  });

  it("le message explique et n'accuse personne", () => {
    expect(MESSAGE_ACCES_RESTREINT).toMatch(/pas ouverte pour le moment/i);
    // Ni « erreur », ni « refusé » : ce n'est pas un échec de l'utilisateur.
    expect(MESSAGE_ACCES_RESTREINT).not.toMatch(/erreur|refus|interdit/i);
  });
});

describe("lienDemandeAcces", () => {
  const lien = lienDemandeAcces();

  it("vise la bonne adresse", () => {
    expect(lien.startsWith(`mailto:${ADRESSE_DEMANDE_ACCES}?`)).toBe(true);
  });

  it("préremplit objet et corps", () => {
    // Sans objet fixe les demandes se perdent dans une boîte de réception ;
    // sans amorce de corps, la plupart arrivent vides.
    expect(lien).toContain("subject=");
    expect(lien).toContain("body=");
    expect(decodeURIComponent(lien)).toMatch(/Demande d'accès à Getgents/);
  });

  it("encode tout ce qui casserait l'URL", () => {
    // Espaces, retours ligne et accents doivent être encodés : un mailto mal
    // formé s'ouvre vide, sans rien signaler.
    const apresPointInterrogation = lien.slice(lien.indexOf("?") + 1);
    expect(apresPointInterrogation).not.toMatch(/[ \n]/);
  });
});

describe("inscription libre plafonnée", () => {
  const { lirePlafondInscriptions, etatDesInscriptions, validerInscription } = require("@/lib/inscriptions") as typeof import("@/lib/inscriptions");
  const { EMAIL_VALIDE } = require("@/lib/demandeAcces") as typeof import("@/lib/demandeAcces");
  const { verifierMotDePasse } = require("@/lib/authMessages") as typeof import("@/lib/authMessages");

  it("variable absente, vide, 0 ou illisible : fermé (retour à la demande d'accès)", () => {
    for (const v of [undefined, "", "0", "abc", "-3"]) expect(lirePlafondInscriptions(v)).toBeNull();
    expect(lirePlafondInscriptions(" 50 ")).toBe(50);
  });

  it("ouvertes jusqu'au plafond, complètes ensuite", () => {
    expect(etatDesInscriptions(null, 0)).toEqual({ genre: "fermees" });
    expect(etatDesInscriptions(50, 49)).toEqual({ genre: "ouvertes", restantes: 1, plafond: 50 });
    expect(etatDesInscriptions(50, 50)).toEqual({ genre: "completes", plafond: 50 });
  });

  it("le libellé suit l'état", () => {
    expect(libelleAppelAction({ genre: "ouvertes", restantes: 3, plafond: 50 })).toBe("Créer un compte");
    expect(libelleAppelAction({ genre: "completes", plafond: 50 })).toBe("Demander un accès");
  });

  it("valide l'adresse et le mot de passe ; le champ piège est accepté en silence", () => {
    const base = { email: "a@b.fr", motDePasse: "motdepasse1", pourQuoi: "", piege: "" };
    expect(validerInscription(base, EMAIL_VALIDE, verifierMotDePasse)).toBeNull();
    expect(validerInscription({ ...base, piege: "x" }, EMAIL_VALIDE, verifierMotDePasse)).toBe("robot");
    expect(validerInscription({ ...base, email: "pas-une-adresse" }, EMAIL_VALIDE, verifierMotDePasse)).toMatch(/adresse/);
    expect(validerInscription({ ...base, motDePasse: "court" }, EMAIL_VALIDE, verifierMotDePasse)).toMatch(/court/);
  });
});

describe("e-mails d'inscription", () => {
  const { emailConfirmation, emailNouvelleInscription } = require("@/lib/emailInscription") as typeof import("@/lib/emailInscription");

  it("le lien de confirmation passe par /auth/confirm, type signup", () => {
    const m = emailConfirmation("a@b.fr", "https://getgents.ai/auth/confirm?token_hash=x&type=signup");
    expect(m.html).toContain("/auth/confirm?token_hash=x&amp;type=signup");
  });

  it("le texte libre du formulaire est échappé dans l'e-mail de l'éditeur", () => {
    expect(emailNouvelleInscription("a@b.fr", "<script>x</script>", 3)).not.toContain("<script>");
  });
});
