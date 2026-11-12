import { cibleDuMode, MODES, ORDRE_MODES } from "@/lib/navigationModes";
import { LIBELLE_STATUT, peutEtreOuvert, statutGent } from "@/lib/statutGent";

describe("les deux modes", () => {
  it("mènent à leur liste quand aucun gent n'est ouvert", () => {
    expect(cibleDuMode("utiliser")).toBe("/myspace");
    expect(cibleDuMode("construire", null)).toBe("/builder/mesgents");
  });

  it("gardent le gent ouvert : son espace d'un côté, ses réglages de l'autre", () => {
    expect(cibleDuMode("utiliser", { id: "draft-1" })).toBe("/espace/draft-1");
    expect(cibleDuMode("construire", { id: "draft-1" })).toBe("/builder/draft-1");
  });

  it("un gent privé s'ouvre à son adresse lisible", () => {
    expect(cibleDuMode("utiliser", { id: "draft-1", diffusionPrivee: true, adressePrivee: "mon-chantier" })).toBe(
      "/espace/mon-chantier"
    );
    expect(cibleDuMode("construire", { id: "draft-1", diffusionPrivee: true, adressePrivee: "mon-chantier" })).toBe(
      "/builder/draft-1"
    );
  });

  it("disent l'action d'abord, la marque ensuite", () => {
    expect(MODES.utiliser).toMatchObject({ libelle: "Utiliser", marque: "GetSpace" });
    expect(MODES.construire).toMatchObject({ libelle: "Construire", marque: "GetStudio" });
    expect(MODES.pages).toMatchObject({ libelle: "Pages", marque: "GetSite" });
  });

  it("Pages, troisième mode, mène toujours à la rubrique : une page ne dépend d'aucun gent", () => {
    expect(ORDRE_MODES).toEqual(["utiliser", "construire", "pages"]);
    expect(cibleDuMode("pages")).toBe("/pages");
    expect(cibleDuMode("pages", { id: "draft-1" })).toBe("/pages");
  });
});

describe("un statut, les mêmes mots partout", () => {
  it("brouillon du studio, gent diffusé, gent privé", () => {
    expect(statutGent({ status: "draft" })).toBe("brouillon");
    expect(statutGent({ status: "review" })).toBe("brouillon");
    expect(statutGent({ status: "published" })).toBe("diffuse");
    expect(statutGent({ status: "draft", diffusionPrivee: true })).toBe("prive");
    expect(statutGent(undefined)).toBe("brouillon");
  });

  it("un espace de GetSpace est diffusé, quel que soit son état d'activité", () => {
    for (const status of ["live", "paused", "done"]) expect(statutGent({ status })).toBe("diffuse");
  });

  it("seul un brouillon ne s'ouvre pas encore", () => {
    expect(peutEtreOuvert("brouillon")).toBe(false);
    expect(peutEtreOuvert("diffuse")).toBe(true);
    expect(peutEtreOuvert("prive")).toBe(true);
    expect(Object.values(LIBELLE_STATUT)).toEqual(["Brouillon", "Diffusé", "Privé"]);
  });
});
