import { extractQuestions, QUICK_REPLY_OTHER_LABEL, SUGGESTIONS_PROMPT_INSTRUCTION } from "@/lib/suggestions";

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
