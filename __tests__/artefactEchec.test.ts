import { artefactEnCoursDEcriture, extractArtefactSignal, MESSAGE_REESSAI_ARTEFACT } from "@/lib/artefactSignal";

describe("échec d'artefact : on dit POURQUOI il manque", () => {
  it("rien d'annoncé : pas d'échec", () => {
    const r = extractArtefactSignal("Une réponse simple.");
    expect(r.artefact).toBeNull();
    expect(r.echec).toBeUndefined();
  });

  it("artefact lisible : pas d'échec", () => {
    const r = extractArtefactSignal('Voici.\n<!--ARTEFACT: {"kind":"checklist","title":"Départ","items":["Passeport"]}-->');
    expect(r.artefact?.title).toBe("Départ");
    expect(r.echec).toBeUndefined();
  });

  it("bloc commencé mais coupé : tronqué, et le texte visible reste intact", () => {
    const r = extractArtefactSignal('Voici la frise.\n<!--ARTEFACT: {"kind":"dashboard","title":"Parcours","dash');
    expect(r.artefact).toBeNull();
    expect(r.echec).toBe("tronque");
    expect(r.text).toBe("Voici la frise.");
  });

  it("bloc complet mais JSON invalide : illisible", () => {
    const r = extractArtefactSignal('Voici.\n<!--ARTEFACT: {"kind":"report","title":"X",}-->');
    expect(r.echec).toBe("illisible");
    expect(r.text).toBe("Voici.");
  });

  it("type inconnu : illisible", () => {
    const r = extractArtefactSignal('Voici.\n<!--ARTEFACT: {"kind":"podcast","title":"X"}-->');
    expect(r.echec).toBe("illisible");
  });

  it("un réessai après coupure demande une version plus courte", () => {
    expect(MESSAGE_REESSAI_ARTEFACT.tronque).toMatch(/compacte/);
  });
});

describe("artefactEnCoursDEcriture", () => {
  it("repère le bloc dès son ouverture, pas les autres blocs cachés", () => {
    expect(artefactEnCoursDEcriture("Texte <!--ARTEFACT: {")).toBe(true);
    expect(artefactEnCoursDEcriture('Texte <!--FOLLOWUPS: ["a"]-->')).toBe(false);
    expect(artefactEnCoursDEcriture("Texte")).toBe(false);
  });
});
