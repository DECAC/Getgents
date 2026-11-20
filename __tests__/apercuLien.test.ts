import { apercuDuLien, descriptionDeLaPage, pourQui } from "@/lib/apercuLien";

const base = { titre: "Week-end à Étretat", destinataire: "Famille Martin", protegee: false, action: null, assistant: false };

describe("aperçu d'un lien de page", () => {
  it("prend la meta description de la page", () => {
    const c = '<head><meta name="description" content="Trois jours au bord de la mer, programme et budget."></head><p>x</p>';
    expect(descriptionDeLaPage(c)).toBe("Trois jours au bord de la mer, programme et budget.");
  });

  it("sinon le chapeau sous le titre, sans balises ni scripts", () => {
    const c = "<script>var p='<p>piège piège piège piège piège piège piège piège</p>'</script><h1>Devis</h1><p>Court</p><p>Nous avons préparé <b>trois options</b> pour votre salle de bains.</p><h2>Détail</h2>";
    expect(descriptionDeLaPage(c)).toBe("Nous avons préparé trois options pour votre salle de bains.");
  });

  it("jamais une note placée après un intertitre", () => {
    expect(descriptionDeLaPage("<h1>Week-end</h1><h2>Budget</h2><p>Arrondi à l'euro supérieur, restaurant compris pour tous.</p>")).toBeNull();
  });

  it("refuse un extrait qui contient une coordonnée", () => {
    const c = "<p>Appelez-moi au 06 12 34 56 78 pour en discuter, je suis disponible toute la semaine.</p>";
    expect(descriptionDeLaPage(c)).toBeNull();
  });

  it("n'affiche jamais une adresse e-mail comme destinataire", () => {
    expect(pourQui("marie@acme.fr")).toBeNull();
    expect(pourQui("Marie")).toBe("Marie");
  });

  it("page protégée : titre seul, aucun extrait, aucun bouton", () => {
    const a = apercuDuLien({ ...base, protegee: true, action: "Je viens", contenu: '<meta name="description" content="Budget secret de 12 000 €">' });
    expect(a.description).not.toContain("12 000");
    expect(a.action).toBeNull();
    expect(a.titre).toBe("Week-end à Étretat");
  });

  it("repli : phrase générique qui ne promet pas un assistant absent", () => {
    const a = apercuDuLien({ ...base, contenu: "", action: "Je viens" });
    expect(a.description).toContain("répondre en un clic");
    expect(a.description).not.toContain("assistant");
    expect(apercuDuLien({ ...base, contenu: "", assistant: true }).description).toContain("assistant");
  });
});

import { enteteVignette, paletteDuTitre, tailleTitre } from "@/lib/vignetteLien";

describe("vignette du lien", () => {
  it("couleur stable pour un même titre", () => {
    expect(paletteDuTitre("Devis")).toBe(paletteDuTitre("Devis"));
  });
  it("titre long plus petit", () => {
    expect(tailleTitre("x".repeat(80))).toBeLessThan(tailleTitre("Court"));
  });
  it("en-tête raccourci, sans destinataire ou lien expiré", () => {
    expect(enteteVignette("Famille Martin", false)).toBe("UNE PAGE POUR FAMILLE MARTIN");
    expect(enteteVignette(null, false)).toBe("UNE PAGE RIEN QUE POUR VOUS");
    expect(enteteVignette("Marie", true)).toBe("UNE PAGE GETGENTS");
    expect(enteteVignette("Les quatre familles du week-end", false).length).toBeLessThan(45);
  });
});
