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
