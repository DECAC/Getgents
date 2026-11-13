import { corpsEmailDemande, MOTIVATION_MAX, normaliserDemande, validerDemande } from "@/lib/demandeAcces";

const motivation = "Un gent qui suit les devis de mes chantiers.";

describe("une demande d'accès", () => {
  it("est recevable avec une adresse et quelques mots", () => {
    expect(validerDemande({ email: "  Marie@Exemple.fr ", motivation })).toBeNull();
    expect(normaliserDemande({ email: "  Marie@Exemple.fr ", motivation }).email).toBe("marie@exemple.fr");
  });

  it("refuse une adresse invalide", () => {
    for (const email of ["", "marie", "marie@", "marie@exemple", "ma rie@exemple.fr", "<a>@x.fr"]) {
      expect(validerDemande({ email, motivation })).toBe("email");
    }
  });

  it("demande quelques mots, sans roman", () => {
    expect(validerDemande({ email: "m@x.fr", motivation: "Accès svp" })).toBe("motivation_courte");
    expect(validerDemande({ email: "m@x.fr", motivation: "a".repeat(MOTIVATION_MAX + 1) })).toBe("motivation_longue");
  });

  it("écarte un robot qui remplit le champ piège", () => {
    expect(validerDemande({ email: "m@x.fr", motivation, piege: "http://spam" })).toBe("robot");
  });
});

describe("l'e-mail reçu par l'éditeur", () => {
  it("contient l'adresse et la motivation, échappées", () => {
    const html = corpsEmailDemande({ email: "m@x.fr", motivation: "<script>alert(1)</script>\nDeuxième ligne" });
    expect(html).toContain("m@x.fr");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<br>Deuxième ligne");
  });
});
