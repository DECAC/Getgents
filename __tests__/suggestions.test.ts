import {
  extractQuestions,
  recoverQuestionsFromChoiceList,
  stripVisibleChoiceList,
  QUICK_REPLY_OTHER_LABEL,
  SUGGESTIONS_PROMPT_INSTRUCTION,
} from "@/lib/suggestions";

describe("extractQuestions", () => {
  it("extrait un bloc QUESTIONS", () => {
    const raw =
      'Veux-tu continuer ?\n<!--QUESTIONS: [{"q":"Veux-tu continuer ?","options":["Oui","Non"],"multi":false}]-->';
    const { text, questions } = extractQuestions(raw);
    expect(text).toBe("Veux-tu continuer ?");
    expect(questions).toEqual([
      { q: "Veux-tu continuer ?", options: ["Oui", "Non"], multi: false },
    ]);
  });

  it("accepte des espaces dans le commentaire et un JSON imbriqué", () => {
    const raw = `Quelle évolution ?
<!-- QUESTIONS: [
  {"q":"Quelle évolution ?","options":["Enrichir « Mini CV [v2] »","Ajouter un onglet"],"multi":false}
] -->`;
    const { text, questions } = extractQuestions(raw);
    expect(text).toBe("Quelle évolution ?");
    expect(questions[0].options).toEqual(["Enrichir « Mini CV [v2] »", "Ajouter un onglet"]);
  });

  it("retire les puces visibles déjà listées dans le JSON", () => {
    const raw =
      "Quelle évolution ?\n\n- Enrichir le mini CV\n- Ajouter un onglet Entretiens\n" +
      '<!--QUESTIONS: [{"q":"Quelle évolution ?","options":["Enrichir le mini CV","Ajouter un onglet Entretiens"]}]-->';
    const { text, questions } = extractQuestions(raw);
    expect(questions).toHaveLength(1);
    expect(text).toBe("Quelle évolution ?");
    expect(text).not.toMatch(/Enrichir le mini CV/);
  });

  it("n'inclut pas Autre dans les options extraites", () => {
    const raw =
      'Choix ?\n<!--QUESTIONS: [{"q":"Choix ?","options":["A","B","Autre"]}]-->';
    const { questions } = extractQuestions(raw);
    expect(questions[0].options).toEqual(["A", "B"]);
  });

  it("cache un bloc QUESTIONS tronqué (flux en cours)", () => {
    const { text, questions } = extractQuestions('Question ?\n<!--QUESTIONS: [{"q":"Question ?"');
    expect(text).toBe("Question ?");
    expect(questions).toEqual([]);
  });
});

describe("recoverQuestionsFromChoiceList", () => {
  it("transforme une liste markdown en boutons", () => {
    const raw =
      "Comment faire évoluer l'aperçu ?\n\n- Enrichir Mon mini CV\n- Ajouter un onglet Entretiens\n- Écarter les alertes";
    const { text, questions } = recoverQuestionsFromChoiceList(raw);
    expect(text).toBe("Comment faire évoluer l'aperçu ?");
    expect(questions).toEqual([
      {
        q: "Comment faire évoluer l'aperçu ?",
        options: ["Enrichir Mon mini CV", "Ajouter un onglet Entretiens", "Écarter les alertes"],
        multi: false,
      },
    ]);
  });

  it("n'invente pas de question s'il n'y a pas de liste", () => {
    expect(recoverQuestionsFromChoiceList("Voici l'aperçu mis à jour.").questions).toEqual([]);
  });
});

describe("stripVisibleChoiceList", () => {
  it("retire une liste numérotée en fin de message", () => {
    const text = stripVisibleChoiceList("Que veux-tu changer ?\n\n1. Option A\n2. Option B");
    expect(text).toBe("Que veux-tu changer ?");
  });
});

describe("SUGGESTIONS_PROMPT_INSTRUCTION", () => {
  it("exige le bloc QUESTIONS pour toute question", () => {
    expect(SUGGESTIONS_PROMPT_INSTRUCTION).toMatch(/SYSTÉMATIQUE/i);
    expect(SUGGESTIONS_PROMPT_INSTRUCTION).toMatch(/Autre/i);
  });

  it("définit le libellé Autre pour l'UI", () => {
    expect(QUICK_REPLY_OTHER_LABEL).toBe("Autre");
  });
});
