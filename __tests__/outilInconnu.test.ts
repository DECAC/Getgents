import { estUnMarqueur, messageOutilInconnu } from "@/lib/outilInconnu";

describe("outil invente par le modele", () => {
  it("reconnait un marqueur du prompt", () => {
    expect(estUnMarqueur("QUESTIONS")).toBe(true);
    expect(estUnMarqueur("questions")).toBe(true);
    expect(estUnMarqueur("PINNED")).toBe(true);
    expect(estUnMarqueur("recherche_web")).toBe(false);
  });

  it("explique au modele qu'un marqueur s'ECRIT, il ne s'appelle pas", () => {
    const m = messageOutilInconnu("QUESTIONS", ["recherche_web"]);
    expect(m).toMatch(/n'est PAS un outil/);
    expect(m).toMatch(/<!--QUESTIONS: …-->/);
    expect(m).toMatch(/recherche_web/);
  });

  it("pour un nom quelconque, dit de ne pas rappeler et de conclure", () => {
    const m = messageOutilInconnu("meteo", ["recherche_web"]);
    expect(m).toMatch(/n'existe pas/);
    expect(m).toMatch(/Ne le rappelle pas/);
    expect(m).toMatch(/Réponds maintenant/);
  });

  it("reste lisible quand aucun outil n'est disponible", () => {
    expect(messageOutilInconnu("meteo", [])).toMatch(/Aucun outil n'est disponible/);
  });
});
