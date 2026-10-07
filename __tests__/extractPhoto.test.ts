import { consigneVisionPhoto, dimensionsReduites, isPhotoFile } from "@/lib/extractPhoto";

describe("photos jointes à la conversation", () => {
  it("reconnaît JPEG, PNG et HEIC d'iPhone, refuse un PDF et un SVG", () => {
    expect(isPhotoFile({ name: "IMG_1.JPG", type: "" })).toBe(true);
    expect(isPhotoFile({ name: "a.png", type: "image/png" })).toBe(true);
    expect(isPhotoFile({ name: "IMG_2.HEIC", type: "" })).toBe(true);
    expect(isPhotoFile({ name: "devis.pdf", type: "application/pdf" })).toBe(false);
    expect(isPhotoFile({ name: "logo.svg", type: "image/svg+xml" })).toBe(false);
  });

  it("réduit le plus grand côté à 1 600 px, sans jamais agrandir", () => {
    expect(dimensionsReduites(4032, 3024)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 1200, hauteur: 1600 });
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
  });

  it("la vision décrit et dit ce que la photo ne permet pas d'affirmer", () => {
    const c = consigneVisionPhoto("fissure.jpg");
    expect(c).toContain("Ce que la photo ne permet pas d'affirmer");
    expect(c).toContain("fissure.jpg");
    expect(c).toMatch(/ni verdict/);
  });
});
