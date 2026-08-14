import {
  artefactMatter,
  convertArtefactToKind,
  convertibleKinds,
  parseNumber,
} from "@/lib/artefactConversion";
import type { Artefact } from "@/lib/types";

function artef(partial: Partial<Artefact> = {}): Artefact {
  return { id: "a1", title: "Bilan", type: "Rapport", icon: "📄", date: "hier", ...partial };
}

const rapport = artef({
  kind: "report",
  body: "## Synthèse\n\nLe marché se tend.\n\n- **Prix estimé** : 685 000 €\n- **Écart** : -2,1 %\n",
});

describe("matière commune", () => {
  it("lit les chiffres au travers des unités", () => {
    expect(parseNumber("685 000 €")).toBe(685000);
    expect(parseNumber("-2,1 %")).toBe(-2.1);
    expect(parseNumber("élevé")).toBeNull();
  });

  it("extrait lignes, couples et chiffres d'un rapport", () => {
    const m = artefactMatter(rapport);
    expect(m.lines).toContain("Synthèse");
    expect(m.pairs.map((p) => p.label)).toEqual(expect.arrayContaining(["Prix estimé", "Écart"]));
    expect(m.numbers.find((n) => n.label === "Prix estimé")?.value).toBe(685000);
  });
});

describe("types atteignables", () => {
  it("n'offre pas ce que le contenu ne permet pas", () => {
    // On ne fabrique pas des coordonnées ni une photo à partir d'un rapport.
    const kinds = convertibleKinds(rapport);
    expect(kinds).toContain("checklist");
    expect(kinds).toContain("dashboard");
    expect(kinds).toContain("chart");
    expect(kinds).not.toContain("map");
    expect(kinds).not.toContain("image");
    expect(kinds).not.toContain("profile-summary");
  });

  it("offre la carte à un artefact qui porte des points", () => {
    const carte = artef({ kind: "map", mapPoints: [{ label: "Gare", lat: 48.8, lon: 2.3 }] } as Partial<Artefact>);
    expect(convertibleKinds(carte)).toContain("map");
  });
});

describe("conversion", () => {
  it("change la STRUCTURE, pas seulement le libellé", () => {
    // Le défaut signalé : le type changeait, le contenu restait un pavé de
    // texte simplement rangé dans un autre onglet.
    const next = convertArtefactToKind(rapport, "checklist");
    expect(next.type).toBe("Checklist");
    expect(next.kind).toBe("checklist");
    expect(next.checklistItems?.length).toBeGreaterThan(0);
    expect(next.checklistItems?.[0].checked).toBe(false);
  });

  it("tire un graphique des valeurs chiffrées", () => {
    const next = convertArtefactToKind(rapport, "chart");
    expect(next.chartData).toEqual(
      expect.arrayContaining([{ label: "Prix estimé", value: 685000 }])
    );
  });

  it("tire un tableau de bord des blocs du rapport", () => {
    const next = convertArtefactToKind(rapport, "dashboard");
    expect(next.dashboard?.blocks.length).toBeGreaterThan(0);
    expect(next.checklistItems).toBeUndefined();
  });

  it("retire la charge de l'ancien type, pour ne pas empiler deux structures", () => {
    const checklist = convertArtefactToKind(rapport, "checklist");
    const graphique = convertArtefactToKind(checklist, "chart");
    expect(graphique.checklistItems).toBeUndefined();
    expect(graphique.chartData?.length).toBeGreaterThan(0);
  });

  it("garde le corps, ce qui rend la conversion réversible", () => {
    const aller = convertArtefactToKind(rapport, "checklist");
    const retour = convertArtefactToKind(aller, "report");
    expect(retour.body).toBe(rapport.body);
    expect(retour.checklistItems).toBeUndefined();
  });

  it("laisse l'artefact intact plutôt que de produire un type vide", () => {
    const sansChiffres = artef({ kind: "report", body: "Une note sans le moindre chiffre." });
    expect(convertArtefactToKind(sansChiffres, "map")).toEqual(sansChiffres);
  });
});

describe("checklist tirée d'un texte", () => {
  const avecListe = artef({
    kind: "report",
    body: "## Avant le départ\n\nQuelques rappels.\n\n- Passeports à vérifier\n- Assurance à souscrire\n- Billets à imprimer\n",
  });

  it("retient la liste du document, pas toute la prose", () => {
    const items = convertArtefactToKind(avecListe, "checklist").checklistItems ?? [];
    expect(items.map((i) => i.label)).toEqual([
      "Passeports à vérifier",
      "Assurance à souscrire",
      "Billets à imprimer",
    ]);
  });

  it("ne garde pas le tiret de liste dans l'étiquette", () => {
    const items = convertArtefactToKind(avecListe, "checklist").checklistItems ?? [];
    expect(items.every((i) => !i.label.startsWith("-"))).toBe(true);
  });
});
