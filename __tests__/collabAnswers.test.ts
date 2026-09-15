import {
  cleSelection,
  envoiImmediat,
  formatterReponses,
  nombreRepondu,
  reponsesCompletes,
  ressembleAUnIdentifiant,
  type QuestionPosee,
} from "@/lib/collabAnswers";

const troisQuestions: QuestionPosee[] = [
  { q: "Quelles sont tes disponibilités ?", options: ["sam. 3 oct", "sam. 17 oct"] },
  { q: "Préférence d'activité ?", options: ["Plein air", "Culturel"] },
  { q: "Airbnb ou hôtel ?", options: ["airbnb", "hotel"] },
];

describe("cleSelection", () => {
  it("distingue deux questions du même message", () => {
    // LE bug d'origine : une clé au seul id de message faisait que répondre à
    // la deuxième question effaçait la réponse à la première.
    expect(cleSelection(42, 0)).not.toBe(cleSelection(42, 1));
  });

  it("distingue la même question de deux messages", () => {
    expect(cleSelection(42, 0)).not.toBe(cleSelection(43, 0));
  });
});

describe("reponsesCompletes", () => {
  it("refuse tant qu'une question reste sans réponse", () => {
    // C'est exactement ce qui se passait : un clic sur une question sur trois
    // partait, l'orchestrateur reposait les deux autres, et ça se lisait
    // comme un doublon.
    expect(reponsesCompletes(troisQuestions, { 0: ["sam. 17 oct"] })).toBe(false);
    expect(reponsesCompletes(troisQuestions, { 0: ["sam. 17 oct"], 1: ["Plein air"] })).toBe(false);
  });

  it("accepte quand tout est répondu", () => {
    expect(
      reponsesCompletes(troisQuestions, { 0: ["sam. 17 oct"], 1: ["Plein air"], 2: ["airbnb"] })
    ).toBe(true);
  });

  it("un lot sans question n'est jamais complet", () => {
    // Sinon un simple message texte afficherait un bouton d'envoi.
    expect(reponsesCompletes([], {})).toBe(false);
  });

  it("une sélection vidée ne compte pas", () => {
    expect(reponsesCompletes(troisQuestions, { 0: [], 1: ["Plein air"], 2: ["airbnb"] })).toBe(false);
  });
});

describe("nombreRepondu", () => {
  it("compte les questions répondues, pas les options choisies", () => {
    // Deux options cochées sur une même question à choix multiple, ça reste
    // UNE question répondue — sinon le décompte annoncerait 2/3 à tort.
    expect(nombreRepondu(troisQuestions, { 0: ["sam. 3 oct", "sam. 17 oct"] })).toBe(1);
  });
});

describe("envoiImmediat", () => {
  it("part au clic pour une question unique à choix unique", () => {
    // Le cas rapide : un bouton de validation en plus serait un clic pour rien.
    expect(envoiImmediat([troisQuestions[0]])).toBe(true);
  });

  it("attend dès qu'il y a plusieurs questions", () => {
    expect(envoiImmediat(troisQuestions)).toBe(false);
  });

  it("attend pour un choix multiple, même seul", () => {
    expect(envoiImmediat([{ q: "Tes dates ?", options: ["a", "b"], multi: true }])).toBe(false);
  });
});

describe("formatterReponses", () => {
  it("rattache chaque réponse à sa question", () => {
    // Sans le libellé, le modèle reçoit « sam. 17 oct, Plein air, airbnb » et
    // doit deviner quelle valeur répond à quoi — c'est là qu'il se trompe et
    // repose la question.
    const texte = formatterReponses(troisQuestions, {
      0: ["sam. 17 oct"],
      1: ["Plein air"],
      2: ["airbnb"],
    });
    expect(texte).toBe(
      "Quelles sont tes disponibilités : sam. 17 oct\n" +
        "Préférence d'activité : Plein air\n" +
        "Airbnb ou hôtel : airbnb"
    );
  });

  it("joint les choix multiples d'une même question", () => {
    expect(formatterReponses([troisQuestions[0]], { 0: ["sam. 3 oct", "sam. 17 oct"] })).toBe(
      "Quelles sont tes disponibilités : sam. 3 oct, sam. 17 oct"
    );
  });

  it("omet les questions sans réponse au lieu d'écrire une ligne vide", () => {
    expect(formatterReponses(troisQuestions, { 1: ["Culturel"] })).toBe(
      "Préférence d'activité : Culturel"
    );
  });

  it("se contente de la réponse si la question n'a pas de libellé", () => {
    expect(formatterReponses([{ q: "", options: ["oui"] }], { 0: ["oui"] })).toBe("oui");
  });
});

describe("ressembleAUnIdentifiant", () => {
  it("reconnaît un identifiant de question du cadre", () => {
    // Observé en production : le fil privé affichait « q_ytdulcnc » au-dessus
    // des pastilles, et la réponse repartait en « q_ytdulcnc : hotel ».
    expect(ressembleAUnIdentifiant("q_ytdulcnc")).toBe(true);
    expect(ressembleAUnIdentifiant("  q-abc123  ")).toBe(true);
  });

  it("laisse passer une vraie question", () => {
    // Le filet ne doit surtout pas manger un libellé légitime.
    expect(ressembleAUnIdentifiant("Airbnb ou hôtel ?")).toBe(false);
    expect(ressembleAUnIdentifiant("Quelles sont tes disponibilités ?")).toBe(false);
    expect(ressembleAUnIdentifiant("Quel budget ?")).toBe(false);
  });

  it("omet l'identifiant dans le message envoyé", () => {
    expect(
      formatterReponses([{ q: "q_ytdulcnc", options: ["airbnb", "hotel"] }], { 0: ["hotel"] })
    ).toBe("hotel");
  });
});
