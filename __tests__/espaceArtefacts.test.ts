import { aDesArtefacts, nombreDArtefacts, MESSAGE_ESPACE_VIDE } from "@/lib/espaceArtefacts";
import type { Espace } from "@/lib/types";

const esp = (p: Record<string, unknown>) => p as unknown as Espace;

describe("presence d'artefacts dans un espace", () => {
  it("compte les modules de l'apercu ET les artefacts gardes", () => {
    expect(nombreDArtefacts(esp({ appPreview: { modules: [1, 2] }, artefacts: [3] }))).toBe(3);
  });

  it("un espace n'est pas vide s'il n'a QUE des modules", () => {
    expect(aDesArtefacts(esp({ appPreview: { modules: [1] }, artefacts: [] }))).toBe(true);
  });

  it("ni s'il n'a QUE des artefacts gardes", () => {
    expect(aDesArtefacts(esp({ appPreview: null, artefacts: [1] }))).toBe(true);
  });

  it("est vide quand les deux sources le sont", () => {
    expect(aDesArtefacts(esp({ appPreview: { modules: [] }, artefacts: [] }))).toBe(false);
    expect(aDesArtefacts(esp({}))).toBe(false);
  });

  it("ne leve pas sur un espace absent", () => {
    expect(nombreDArtefacts(null)).toBe(0);
    expect(aDesArtefacts(undefined)).toBe(false);
  });

  it("le message d'espace vide explique la mecanique, il ne constate pas", () => {
    expect(MESSAGE_ESPACE_VIDE).toMatch(/naissent de vos échanges/);
    expect(MESSAGE_ESPACE_VIDE).toMatch(/se rangera ici/);
  });
});
