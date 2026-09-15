import { estEmailPlausible, estSoiMeme, normalizeEmail } from "@/lib/emailIdentity";

describe("normalisation d'adresse", () => {
  it("rejoint les écritures d'une même adresse", () => {
    // Sans cela, deux invitations concurrentes s'ouvriraient sur le même gent,
    // avec deux rôles possiblement contradictoires.
    expect(normalizeEmail("  Marie@Exemple.FR ")).toBe("marie@exemple.fr");
    expect(normalizeEmail("marie@exemple.fr")).toBe(normalizeEmail("MARIE@EXEMPLE.FR"));
  });

  it("ne touche NI aux points NI aux marqueurs +tag", () => {
    // Ces règles sont propres à certains fournisseurs et changent. Les
    // appliquer ferait qu'inviter marie+getgents@gmail.com donnerait l'accès
    // à marie@gmail.com — surprenant et inexplicable.
    expect(normalizeEmail("ma.rie+getgents@gmail.com")).toBe("ma.rie+getgents@gmail.com");
  });
});

describe("plausibilité", () => {
  it("accepte les adresses ordinaires et inhabituelles", () => {
    for (const e of [
      "marie@exemple.fr",
      "marie+tag@sous.domaine.co.uk",
      "prenom.nom@entreprise-longue.example",
    ]) {
      expect(estEmailPlausible(e)).toBe(true);
    }
  });

  it("refuse ce qui ne peut pas être une adresse", () => {
    for (const e of ["", "marie", "marie@", "@exemple.fr", "marie exemple.fr", "marie@exemple", "a@b.c d"]) {
      expect(estEmailPlausible(e)).toBe(false);
    }
  });

  it("refuse un domaine mal formé", () => {
    for (const e of ["marie@.fr", "marie@exemple.", "marie@ex..fr"]) {
      expect(estEmailPlausible(e)).toBe(false);
    }
  });
});

describe("auto-invitation", () => {
  it("reconnaît qu'on s'invite soi-même, quelle que soit la casse", () => {
    expect(estSoiMeme("Marie@Ex.fr", "marie@ex.fr")).toBe(true);
    expect(estSoiMeme("autre@ex.fr", "marie@ex.fr")).toBe(false);
  });

  it("ne suppose rien sans adresse connue", () => {
    expect(estSoiMeme("marie@ex.fr", null)).toBe(false);
  });
});
