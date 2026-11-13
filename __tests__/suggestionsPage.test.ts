import { cleQuestion, estSuggeree, propositions, suggestionsParDefaut, suggestionsValides, SUGGESTIONS_MAX } from "@/lib/suggestionsPage";

describe("questions suggérées aux visiteurs", () => {
  it("compare sans accents, ponctuation ni casse", () => {
    expect(cleQuestion("Quel est le délai de paiement ?")).toBe(cleQuestion("quel est le DELAI de paiement"));
    expect(cleQuestion("Résume ce document")).not.toBe(cleQuestion("Résume ce devis"));
  });

  it("par défaut : les amorces génériques, 4 au plus", () => {
    expect(suggestionsParDefaut(["a", "b", "c", "d", "e"]).map((s) => s.origine)).toEqual(["defaut", "defaut", "defaut", "defaut"]);
  });

  it("valide ce qu'envoie l'auteur et écarte les doublons", () => {
    expect(
      suggestionsValides({
        suggestions: [
          { texte: "  Une remise   est-elle possible ? ", origine: "question", questionId: "11111111-1111-1111-1111-111111111111" },
          { texte: "une remise est-elle possible", origine: "libre" },
          { texte: "Résume ce document", origine: "defaut" },
        ],
      })
    ).toEqual([
      { texte: "Une remise est-elle possible ?", origine: "question", questionId: "11111111-1111-1111-1111-111111111111" },
      { texte: "Résume ce document", origine: "defaut" },
    ]);
  });

  it("refuse trop de suggestions, une vide ou trop longue", () => {
    const n = Array.from({ length: SUGGESTIONS_MAX + 1 }, (_, i) => ({ texte: `Q${i}` }));
    expect(suggestionsValides({ suggestions: n })).toBeNull();
    expect(suggestionsValides({ suggestions: [{ texte: " " }] })).toBeNull();
    expect(suggestionsValides({ suggestions: [{ texte: "x".repeat(201) }] })).toBeNull();
    expect(suggestionsValides({})).toBeNull();
    // Une liste vide est légitime : l'auteur ne veut aucune bulle.
    expect(suggestionsValides({ suggestions: [] })).toEqual([]);
  });

  it("propose les questions répondues, posées au moins deux fois, pas déjà suggérées", () => {
    const qs = [
      { id: "a", question: "Combien coûte le projet ?", repondue: true },
      { id: "b", question: "combien coûte le projet", repondue: true },
      { id: "c", question: "Combien coûte le projet ?", repondue: true },
      { id: "d", question: "Qui pilote le lot 3 ?", repondue: false },
      { id: "e", question: "Qui pilote le lot 3 ?", repondue: false },
      { id: "f", question: "Quel délai ?", repondue: true },
      { id: "g", question: "Quel délai ?", repondue: true },
      { id: "h", question: "Une seule fois ?", repondue: true },
    ];
    const p = propositions(qs, [{ texte: "Quel délai", origine: "libre" }]);
    expect(p).toEqual([{ texte: "Combien coûte le projet ?", occurrences: 3, formulations: 2, questionId: "a" }]);
  });

  it("reconnaît une question déjà suggérée, par identifiant ou par texte", () => {
    const s = [{ texte: "Une remise est-elle possible ?", origine: "question" as const, questionId: "q1" }];
    expect(estSuggeree({ id: "q1", question: "Peut-on avoir une remise chez Acme ?" }, s)).toBe(true);
    expect(estSuggeree({ question: "une remise est-elle possible" }, s)).toBe(true);
    expect(estSuggeree({ id: "q2", question: "Quel délai ?" }, s)).toBe(false);
  });

  it("une suggestion REFORMULÉE couvre encore sa question d'origine et ses variantes", () => {
    const qs = [
      { id: "a", question: "Quel est le total ?", repondue: true },
      { id: "b", question: "quel est le total", repondue: true },
    ];
    const s = [{ texte: "Quel est le montant total ?", origine: "question" as const, questionId: "a" }];
    expect(propositions(qs, s)).toEqual([]);
    expect(estSuggeree({ id: "b", question: "quel est le total" }, s, qs)).toBe(true);
  });
});
