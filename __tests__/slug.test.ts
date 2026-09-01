import {
  SLUGS_RESERVES,
  SLUG_MAX,
  slugMessage,
  slugProbleme,
  slugSuivant,
  toSlug,
} from "@/lib/slug";

describe("fabrication d'une adresse", () => {
  it("déplie les accents et remplace le reste par des tirets", () => {
    expect(toSlug("Radar Emploi")).toBe("radar-emploi");
    expect(toSlug("Résumé du marché — 2026")).toBe("resume-du-marche-2026");
    expect(toSlug("Compagnon d'Élise")).toBe("compagnon-d-elise");
  });

  it("ne laisse jamais de tiret aux extrémités", () => {
    expect(toSlug("  -- Voyage !! --  ")).toBe("voyage");
    expect(toSlug("!!!")).toBe("");
  });

  it("borne la longueur sans laisser de tiret orphelin", () => {
    const long = toSlug("un ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("adresses refusées", () => {
  it("refuse les noms que l'application s'attribue", () => {
    // Le gent serait injoignable : Next sert la route statique en priorité.
    // Et le créateur croirait avoir publié.
    for (const nom of ["builder", "api", "espace", "compte", "annuaire", "connexion"]) {
      expect(slugProbleme(nom)).toBe("reserve");
    }
  });

  it("refuse ce qui n'est pas une adresse", () => {
    expect(slugProbleme("")).toBe("vide");
    expect(slugProbleme("ab")).toBe("trop-court");
    expect(slugProbleme("a".repeat(SLUG_MAX + 1))).toBe("trop-long");
    for (const mauvais of ["Radar", "radar_emploi", "radar emploi", "-radar", "radar-", "radar--emploi", "café"]) {
      expect(slugProbleme(mauvais)).toBe("format");
    }
  });

  it("accepte une adresse ordinaire", () => {
    for (const bon of ["radar-emploi", "compagnon2026", "mon-gent-a-moi"]) {
      expect(slugProbleme(bon)).toBeNull();
    }
  });

  it("explique chaque refus", () => {
    for (const p of ["vide", "trop-court", "trop-long", "reserve", "format"] as const) {
      expect(slugMessage(p).length).toBeGreaterThan(15);
    }
  });

  it("réserve toutes les routes de premier niveau existantes", () => {
    // Une route ajoutée sans être réservée casserait l'adresse d'un gent déjà
    // publié — et déjà indexé par les moteurs.
    for (const route of ["builder", "espace", "api", "auth", "l", "compte", "accueil", "annuaire"]) {
      expect(SLUGS_RESERVES.has(route)).toBe(true);
    }
  });
});

describe("collision d'adresses", () => {
  it("rend la base quand elle est libre", () => {
    expect(slugSuivant("radar-emploi", [])).toBe("radar-emploi");
  });

  it("numérote plutôt que de tirer au hasard", () => {
    // Une adresse doit rester dictable au téléphone.
    expect(slugSuivant("radar-emploi", ["radar-emploi"])).toBe("radar-emploi-2");
    expect(slugSuivant("radar-emploi", ["radar-emploi", "radar-emploi-2"])).toBe("radar-emploi-3");
  });

  it("contourne aussi les noms réservés", () => {
    expect(slugSuivant("builder", [])).toBe("builder-2");
  });

  it("ne dépasse jamais la longueur maximale", () => {
    const base = "a".repeat(SLUG_MAX);
    expect(slugSuivant(base, [base]).length).toBeLessThanOrEqual(SLUG_MAX);
  });
});
