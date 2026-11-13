import { filtrePage, filtrerParTitre, initiales, libelleFormat } from "@/lib/pagesGetsite";
import { SLUGS_RESERVES } from "@/lib/slug";

describe("rubrique Pages", () => {
  it("filtre : active = au moins un lien qui s'ouvre encore, ou aucun lien encore", () => {
    expect(filtrePage({ actifs: 2, liens: 3 }, "actives")).toBe(true);
    expect(filtrePage({ actifs: 0, liens: 2 }, "actives")).toBe(false);
    expect(filtrePage({ actifs: 0, liens: 2 }, "expirees")).toBe(true);
    expect(filtrePage({ actifs: 3, liens: 3 }, "toutes")).toBe(true);
  });

  it("une page jamais partagée (collée) reste dans la vue par défaut", () => {
    expect(filtrePage({ actifs: 0, liens: 0 }, "actives")).toBe(true);
    expect(filtrePage({ actifs: 0, liens: 0 }, "expirees")).toBe(false);
  });

  it("recherche sans accents ni casse, titre et plateforme", () => {
    const pages = [
      { titre: "Proposition Acme", origine: "Claude" },
      { titre: "Étude énergie", origine: null },
    ];
    expect(filtrerParTitre(pages, "etude")).toHaveLength(1);
    expect(filtrerParTitre(pages, "claude acme")).toHaveLength(1);
    expect(filtrerParTitre(pages, "")).toHaveLength(2);
  });

  it("initiales d'un nom ou d'une adresse", () => {
    expect(initiales("Marie Dupont")).toBe("MD");
    expect(initiales("paul@acme.fr")).toBe("PA");
    expect(initiales("jean.marc.durand@x.fr")).toBe("JD");
    expect(initiales("  ")).toBe("?");
  });

  it("des formats en mots, pas en jargon", () => {
    expect(libelleFormat("react")).toBe("Application");
    expect(libelleFormat("html")).toBe("HTML");
  });

  it("/pages est une adresse réservée : aucun gent ne peut la prendre", () => {
    expect(SLUGS_RESERVES.has("pages")).toBe(true);
  });
});
