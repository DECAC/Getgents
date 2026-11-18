import { CREDITS, EDITEUR, HEBERGEURS, SOUS_TRAITANTS, securityTxt } from "@/lib/legal";
import { SLUGS_RESERVES } from "@/lib/slug";

describe("identité de l'éditeur", () => {
  it("l'adresse de contact est sur le domaine que nous possédons", () => {
    // Des mentions légales pointant vers une boîte non configurée valent une
    // absence de mentions : le catégoriseur qui écrit n'obtient jamais de
    // réponse, et conclut à un domaine abandonné.
    expect(EDITEUR.contact.endsWith("@getgents.ai")).toBe(true);
  });

  it("ne fabrique jamais d'adresse postale", () => {
    // Sous le régime non professionnel (LCEN art. 6 III), elle est
    // communiquée à l'hébergeur et non au public. Si l'on en publie une un
    // jour, ce sera une vraie adresse — jamais un texte de remplissage.
    expect(EDITEUR.adressePostale === null || EDITEUR.adressePostale.length > 10).toBe(true);
  });

  it("n'annonce aucune société tant qu'il n'y en a pas", () => {
    // Ces pages ont d'abord publié « Raison sociale : The G Company », pour
    // une société qui n'existait pas. Ce test empêche la rechute.
    const societe = /\b(SAS|SASU|SARL|EURL|SA|SCI|société|company|inc\.?|ltd)\b/i;
    expect(societe.test(EDITEUR.designation)).toBe(false);
    if (EDITEUR.immatriculation === null) {
      expect(EDITEUR.qualite).toMatch(/non professionnelle|personne physique/i);
    }
  });

  it("le nom de l'auteur n'apparaît que dans les crédits", () => {
    // Régime anonyme de la LCEN (18/11) : le nom n'est affiché NULLE PART,
    // sauf dans la section Crédits de la page À propos (via `CREDITS`).
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const nom = CREDITS.auteur.split(" ").pop()!.toLowerCase();
    const fautifs: string[] = [];
    const parcourir = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) parcourir(p);
        else if (/\.(tsx?|css|html|json|txt)$/.test(e.name) && fs.readFileSync(p, "utf8").toLowerCase().includes(nom)) fautifs.push(p);
      }
    };
    for (const d of ["app", "components", "public", "supabase/templates"]) parcourir(path.join(process.cwd(), d));
    expect(fautifs).toEqual([]);
    expect(Object.values(EDITEUR).join(" ").toLowerCase()).not.toContain(nom);
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
