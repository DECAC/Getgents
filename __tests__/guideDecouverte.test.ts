import { etapesDecouverte, type EtatDecouverte } from "@/lib/guideDecouverte";
import { EXEMPLES, exempleDeOrigine, origineExemple } from "@/lib/exemplesPages";
import { donneesPersonnelles } from "@/lib/donneesPersonnelles";

const base: EtatDecouverte = { liens: 0, ouvertures: 0, questions: 0, precisions: 0, assistant: true, exemple: true, questionPiege: "Peut-on payer en trois fois ?", questionArrivee: false };

describe("guide de découverte", () => {
  it("une seule étape active : la première non faite", () => {
    expect(etapesDecouverte(base).map((e) => e.active)).toEqual([true, false, false]);
    expect(etapesDecouverte({ ...base, liens: 1 }).map((e) => e.active)).toEqual([false, true, false]);
  });

  it("exemple : l'étape 3 attend la RÉPONSE de l'auteur, pas l'arrivée de la question", () => {
    const arrivee = etapesDecouverte({ ...base, liens: 1, ouvertures: 1, questions: 1, questionArrivee: true })[2];
    expect(arrivee.faite).toBe(false);
    expect(arrivee.titre).toBe("Répondez à la question");
    expect(etapesDecouverte({ ...base, liens: 1, ouvertures: 1, questions: 1, questionArrivee: true, precisions: 1 })[2].faite).toBe(true);
  });

  it("vraie page : une question reçue suffit, sans question piège", () => {
    const e = { ...base, exemple: false, questionPiege: null };
    expect(etapesDecouverte({ ...e, questions: 1 })[2].faite).toBe(true);
    expect(etapesDecouverte(e)[2].texte).not.toMatch(/trois fois/);
  });

  it("l'étape 2 explique la navigation privée tant qu'elle n'est pas faite", () => {
    expect(etapesDecouverte(base)[1].texte).toMatch(/navigation privée/);
  });
});

describe("pages d'exemple", () => {
  it("chaque exemple est autonome : ni script, ni police, ni feuille externes", () => {
    for (const ex of EXEMPLES) {
      expect(ex.contenu).not.toMatch(/<script[^>]+src=/i);
      expect(ex.contenu).not.toMatch(/<link[^>]+href=["']https?:/i);
      expect(ex.contenu).not.toMatch(/@import|fonts\.googleapis/i);
    }
  });

  it("aucune coordonnée : l'alerte « données personnelles » ne part pas au premier essai", () => {
    for (const ex of EXEMPLES) expect(donneesPersonnelles(ex.contenu)).toEqual({ emails: [], telephones: [] });
  });

  it("la question piège est suggérée, et la page n'en dit rien", () => {
    for (const ex of EXEMPLES) {
      expect(ex.suggestions).toContain(ex.questionPiege);
      expect(ex.contenu).toMatch(/fictif/i);
    }
    expect(EXEMPLES.find((e) => e.id === "proposition")!.contenu).not.toMatch(/trois fois|plusieurs fois|échelonn/i);
    expect(EXEMPLES.find((e) => e.id === "cv")!.contenu).not.toMatch(/temps partiel|mi-temps/i);
  });

  it("l'origine d'une page d'exemple retrouve son exemple", () => {
    expect(exempleDeOrigine(origineExemple("cv"))?.id).toBe("cv");
    expect(exempleDeOrigine("Claude")).toBeNull();
  });
});
