import { EDITEUR, HEBERGEURS, SOUS_TRAITANTS, securityTxt } from "@/lib/legal";
import { SLUGS_RESERVES } from "@/lib/slug";

describe("identité de l'éditeur", () => {
  it("l'adresse de contact est sur le domaine que nous possédons", () => {
    // Des mentions légales pointant vers une boîte non configurée valent une
    // absence de mentions : le catégoriseur qui écrit n'obtient jamais de
    // réponse, et conclut à un domaine abandonné.
    expect(EDITEUR.contact.endsWith("@getgents.ai")).toBe(true);
  });

  it("ne fabrique jamais d'adresse postale", () => {
    // Elle est obligatoire (LCEN art. 6 III) et manque encore. Ce test garde
    // l'invariant : tant qu'elle est inconnue, on l'omet — un siège inventé
    // est invérifiable, donc pire qu'un vide assumé.
    expect(EDITEUR.adressePostale === null || EDITEUR.adressePostale.length > 10).toBe(true);
  });
});

describe("hébergeurs et sous-traitants", () => {
  it("chaque hébergeur est nommé, situé et joignable", () => {
    for (const h of HEBERGEURS) {
      expect(h.nom.length).toBeGreaterThan(0);
      expect(h.adresse.length).toBeGreaterThan(10);
      expect(h.site.startsWith("https://")).toBe(true);
    }
  });

  it("chaque sous-traitant dit ce qui lui est transmis", () => {
    // Une politique de confidentialité qui écrit « des données techniques »
    // n'informe personne. Chaque ligne doit nommer la donnée réelle.
    for (const s of SOUS_TRAITANTS) {
      expect(s.donnees.length).toBeGreaterThan(20);
      expect(s.role.length).toBeGreaterThan(0);
    }
  });
});

describe("securityTxt", () => {
  const txt = securityTxt("https://getgents.ai/", "2027-09-03T00:00:00.000Z");

  it("porte les champs exigés par la RFC 9116", () => {
    expect(txt).toContain(`Contact: mailto:${EDITEUR.contact}`);
    expect(txt).toContain("Expires: 2027-09-03T00:00:00.000Z");
  });

  it("ne double jamais la barre oblique de l'URL canonique", () => {
    // La base arrive tantôt avec, tantôt sans barre finale selon la variable
    // d'environnement ; un `//` rend le champ Canonical faux.
    expect(txt).toContain("Canonical: https://getgents.ai/.well-known/security.txt");
  });
});

describe("les adresses légales sont réservées", () => {
  it("aucun gent ne peut s'appeler comme une page légale", () => {
    for (const slug of ["mentions-legales", "confidentialite", "contact", "a-propos"]) {
      expect(SLUGS_RESERVES).toContain(slug);
    }
  });
});
