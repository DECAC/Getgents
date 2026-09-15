import {
  isTrustAnswer,
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

  // Tours d'outils : le moteur diffuse le texte de chaque tour et le
  // navigateur concatène. Le dernier bloc complet est la question réellement
  // posée ; tous les blocs disparaissent du texte visible.
  it("garde le DERNIER bloc complet quand la réponse en contient plusieurs", () => {
    const raw =
      'Je vérifie un chiffre.\n<!--QUESTIONS: [{"q":"Ancienne ?","options":["X","Y"]}]-->\n' +
      'Situation — déficit à 5,8 %.\nQuestion — Quel levier ?\n<!--QUESTIONS: [{"q":"Quel levier ?","options":["Économies","Impôts","Dette"]}]-->';
    const { text, questions } = extractQuestions(raw);
    expect(questions).toHaveLength(1);
    expect(questions[0].q).toBe("Quel levier ?");
    expect(questions[0].options).toEqual(["Économies", "Impôts", "Dette"]);
    expect(text).not.toMatch(/QUESTIONS/);
    expect(text).toMatch(/Je vérifie un chiffre/);
    expect(text).toMatch(/Quel levier \?$/);
  });

  it("un bloc tronqué en début de réponse ne fait pas disparaître la suite", () => {
    const raw =
      'Un instant.\n<!--QUESTIONS: [{"q":"Coupée","options":["A"\n' +
      'Question — Quelle position sur les retraites ?\n<!--QUESTIONS: [{"q":"Quelle position sur les retraites ?","options":["Réforme","Statu quo"]}]-->';
    const { text, questions } = extractQuestions(raw);
    expect(questions[0].options).toEqual(["Réforme", "Statu quo"]);
    expect(text).toMatch(/Quelle position sur les retraites \?/);
    expect(text).not.toMatch(/Coupée|QUESTIONS/);
  });

  it("un bloc tronqué suivi de texte puis d'un FOLLOWUPS ne masque pas ce texte", () => {
    const raw =
      'Intro.\n<!--QUESTIONS: [{"q":"Coupée"\nTexte final visible.\n<!--FOLLOWUPS: ["Suite ?"]-->';
    const { text, questions } = extractQuestions(raw);
    expect(questions).toEqual([]);
    expect(text).toMatch(/Intro\./);
    expect(text).toMatch(/Texte final visible\./);
    expect(text).toMatch(/<!--FOLLOWUPS/);
  });

  it("accepte des options sous forme d'objets { label }", () => {
    const raw =
      'Choix ?\n<!--QUESTIONS: [{"q":"Choix ?","options":[{"label":"Oui"},{"text":"Non"},42]}]-->';
    const { questions } = extractQuestions(raw);
    expect(questions[0].options).toEqual(["Oui", "Non"]);
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

  it("reconnaît une liste lettrée (A) B) C)) typique d'un jeu de rôle", () => {
    const raw =
      "Question — Quelle réponse à la crise des urgences ?\nA) Plan de revalorisation ciblé\nB) Recours à l'intérim\nC) Fermetures de nuit assumées";
    const { text, questions } = recoverQuestionsFromChoiceList(raw, { requireQuestion: true });
    expect(text).toBe("Question — Quelle réponse à la crise des urgences ?");
    expect(questions[0].options).toEqual([
      "Plan de revalorisation ciblé",
      "Recours à l'intérim",
      "Fermetures de nuit assumées",
    ]);
  });

  it("avec requireQuestion, laisse intacte une liste qui ne suit pas une question", () => {
    const raw = "Trois conseils pour la suite.\n- Relire le CV\n- Préparer l'entretien\n- Relancer le recruteur";
    const { text, questions } = recoverQuestionsFromChoiceList(raw, { requireQuestion: true });
    expect(questions).toEqual([]);
    expect(text).toBe(raw);
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

describe("pseudo-options ajoutées par l'interface", () => {
  it("les filtre du JSON du modèle pour éviter les doublons", () => {
    // « Autre » et « Fais-moi confiance » sont ajoutées par QuickReplyQuestions.
    // Si le modèle les reprend, elles apparaîtraient deux fois dans la liste.
    const raw =
      'Quels onglets ?\n<!--QUESTIONS: [{"q":"Quels onglets ?","options":["Suivi","Autre","Fais-moi confiance","Analyse"],"multi":false}]-->';
    const { questions } = extractQuestions(raw);
    expect(questions[0].options).toEqual(["Suivi", "Analyse"]);
  });

  it("reconnaît une réponse « fais-moi confiance » quelle que soit la casse", () => {
    expect(isTrustAnswer("1. Quels onglets ? → Fais-moi confiance")).toBe(true);
    expect(isTrustAnswer("Quels onglets ? → FAIS-MOI CONFIANCE")).toBe(true);
    expect(isTrustAnswer("Quels onglets ? → Suivi, Analyse")).toBe(false);
  });
});
