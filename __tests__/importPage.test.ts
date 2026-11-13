import { alertesImport, detecterFormat, libelleOrigine, lignesVisibles, nettoyerCollage, ORIGINE_COLLAGE, premiereDifference, titreDetecte } from "@/lib/importPage";
import { donneesPersonnelles } from "@/lib/donneesPersonnelles";
import { controleFidelite } from "@/lib/mcpPartage";

const html = `<!doctype html><html><head><title>Proposition — Acme</title></head><body><h1>Offre</h1><p>Total : 46 500 € HT</p></body></html>`;
const jsx = `import { useState } from "react";\nexport default function TableauDeBord() {\n  const [n, setN] = useState(0);\n  return <div><h1>Bilan {n}</h1></div>;\n}`;

describe("créer une page par collage", () => {
  it("déballe un bloc de code Markdown qui entoure tout le collage", () => {
    expect(nettoyerCollage("```html\n<p>x</p>\n```")).toBe("<p>x</p>");
    expect(nettoyerCollage("﻿  <p>x</p>\r\n")).toBe("<p>x</p>");
    // Un bloc de code AU MILIEU d'un document Markdown reste en place.
    expect(nettoyerCollage("# Titre\n```js\nx\n```")).toBe("# Titre\n```js\nx\n```");
  });

  it("détecte le format par l'extension, sinon par le contenu", () => {
    expect(detecterFormat("n'importe quoi", "page.jsx")).toBe("react");
    expect(detecterFormat(html)).toBe("html");
    expect(detecterFormat(jsx)).toBe("react");
    expect(detecterFormat('<svg viewBox="0 0 10 10"></svg>')).toBe("svg");
    expect(detecterFormat("# Compte rendu\n\n- point 1")).toBe("markdown");
    expect(detecterFormat("<div class='x'>Bonjour</div>")).toBe("html");
    expect(detecterFormat("Simple texte.")).toBe("texte");
  });

  it("propose un titre", () => {
    expect(titreDetecte(html, "html")).toBe("Proposition — Acme");
    expect(titreDetecte("<h1>Offre <b>2026</b></h1>", "html")).toBe("Offre 2026");
    expect(titreDetecte("# Compte **rendu**\ntexte", "markdown")).toBe("Compte rendu");
    expect(titreDetecte(jsx, "react")).toBe("Tableau De Bord");
    expect(titreDetecte("<p>rien</p>", "html")).toBe("");
  });

  it("repère e-mails et téléphones, pas les adresses d'exemple ni les images encodées", () => {
    const d = donneesPersonnelles("Contact : Marie@Acme.fr, 06 12 34 56 78, +33 1 23 45 67 89 · demo@example.com · data:image/png;base64,QUJD@x.fr");
    expect(d.emails).toEqual(["marie@acme.fr"]);
    expect(d.telephones).toEqual(["06 12 34 56 78", "+33 1 23 45 67 89"]);
    expect(donneesPersonnelles("Total 46 500 €, version 1.2.3, 2026-11-13").telephones).toEqual([]);
  });

  it("alerte sans bloquer, sauf contenu vide", () => {
    expect(alertesImport("", "html")[0].niveau).toBe("bloquant");
    expect(alertesImport(html, "html")).toEqual([]);
    const a = alertesImport('<p>marie@acme.fr</p><script>window.claude.complete("x")</script>', "html");
    expect(a.map((x) => x.niveau)).toEqual(["attention", "attention"]);
    expect(a.map((x) => x.texte).join(" ")).toMatch(/Claude/);
    expect(a.map((x) => x.texte).join(" ")).toMatch(/marie@acme\.fr/);
  });

  it("le connecteur voit aussi les coordonnées", () => {
    expect(controleFidelite("<p>marie@acme.fr</p>", "html").donnees.emails).toEqual(["marie@acme.fr"]);
  });

  it("dit ce qui change d'une version à l'autre, en une ligne", () => {
    const v2 = html.replace("46 500", "48 000");
    expect(premiereDifference(html, v2)).toEqual({ identique: false, avant: "Total : 46 500 € HT", apres: "Total : 48 000 € HT" });
    expect(premiereDifference(html, html).identique).toBe(true);
    expect(premiereDifference(html, html.replace("<h1>", '<h1 class="x">'))).toEqual({ identique: false, avant: null, apres: null });
    expect(lignesVisibles("<style>p{}</style><p>a</p><p>b</p>")).toEqual(["a", "b"]);
  });

  it("l'origine d'une page collée se lit « Collée à la main »", () => {
    expect(libelleOrigine(ORIGINE_COLLAGE)).toBe("Collée à la main");
    expect(libelleOrigine("Claude")).toBe("Créée dans Claude");
    expect(libelleOrigine(null)).toBeNull();
  });
});
