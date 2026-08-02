import { compactDelimited, parseDelimitedLine } from "@/lib/extractDocumentText";

describe("découpage d'une ligne délimitée", () => {
  it("respecte les guillemets encadrant une virgule", () => {
    expect(parseDelimitedLine('Dupont,"Directeur, Ventes",Acme', ",")).toEqual([
      "Dupont",
      "Directeur, Ventes",
      "Acme",
    ]);
  });

  it("gère les guillemets échappés", () => {
    expect(parseDelimitedLine('a,"il a dit ""oui""",b', ",")).toEqual(["a", 'il a dit "oui"', "b"]);
  });

  it("conserve les champs vides", () => {
    expect(parseDelimitedLine("a,,c", ",")).toEqual(["a", "", "c"]);
  });
});

describe("normalisation d'un export LinkedIn", () => {
  // Forme réelle du fichier : trois lignes de préambule avant l'en-tête.
  const linkedin = [
    "Notes:",
    '"Lorsque vous exportez votre liste de relations, certaines données peuvent être absentes."',
    "",
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
    "Marie,Dupont,https://www.linkedin.com/in/mdupont,marie@exemple.fr,Doctolib,Directrice Produit,14 Mar 2024",
    "Jean,Martin,https://www.linkedin.com/in/jmartin,,Capgemini,\"Consultant, Avant-vente\",02 Jan 2020",
  ].join("\n");

  const out = compactDelimited(linkedin, ",");

  it("saute le préambule et retient la vraie ligne d'en-tête", () => {
    expect(out.split("\n")[0]).toContain("First Name");
    expect(out).not.toContain("Notes:");
    expect(out).not.toContain("certaines données peuvent être absentes");
  });

  it("retire la colonne d'adresses e-mail", () => {
    expect(out).not.toContain("Email Address");
    expect(out).not.toContain("marie@exemple.fr");
  });

  it("conserve les données utiles au classement des contacts", () => {
    expect(out).toContain("Doctolib");
    expect(out).toContain("Directrice Produit");
    expect(out).toContain("Capgemini");
    expect(out).toContain("14 Mar 2024");
  });

  it("garde une ligne par relation", () => {
    expect(out.split("\n")).toHaveLength(3); // en-tête + 2 relations
  });
});

describe("robustesse", () => {
  it("abandonne les colonnes entièrement vides", () => {
    const out = compactDelimited("Nom,Vide,Ville\nMarie,,Paris\nJean,,Lyon", ",");
    expect(out).toBe("Nom,Ville\nMarie,Paris\nJean,Lyon");
  });

  it("laisse le contenu intact quand aucun en-tête n'est identifiable", () => {
    const raw = "une seule ligne sans délimiteur";
    expect(compactDelimited(raw, ",")).toBe(raw);
  });

  it("gère les fins de ligne Windows et le BOM", () => {
    const out = compactDelimited("﻿Nom,Ville\r\nMarie,Paris\r\n", ",");
    expect(out).toBe("Nom,Ville\nMarie,Paris");
  });

  it("traite aussi le format tabulé", () => {
    expect(compactDelimited("Nom\tVille\nMarie\tParis", "\t")).toBe("Nom\tVille\nMarie\tParis");
  });
});
