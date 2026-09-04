import { collecteTerminee, doitEnchainer, doitPasserEnPropositions } from "@/lib/collabPhase";

describe("collecteTerminee", () => {
  it("est vraie quand tout le monde a répondu", () => {
    expect(collecteTerminee({ answered: 3, total: 3 })).toBe(true);
  });

  it("est fausse tant qu'il manque quelqu'un", () => {
    expect(collecteTerminee({ answered: 2, total: 3 })).toBe(false);
  });

  it("est fausse sur un salon vide", () => {
    // Sans ce garde-fou, 0 === 0 ferait basculer la mission en propositions
    // dès son ouverture, avant que le premier participant n'arrive.
    expect(collecteTerminee({ answered: 0, total: 0 })).toBe(false);
  });
});

describe("doitPasserEnPropositions", () => {
  it("bascule depuis la collecte terminée", () => {
    // Le blocage observé : trois participants avaient répondu, l'orchestrateur
    // avait annoncé des propositions en prose sans émettre l'action `status`,
    // et la mission restait en collecte indéfiniment.
    expect(doitPasserEnPropositions("collecting", { answered: 3, total: 3 })).toBe(true);
  });

  it("ne rebascule pas depuis proposing", () => {
    expect(doitPasserEnPropositions("proposing", { answered: 3, total: 3 })).toBe(false);
  });

  it("ne ressuscite jamais une mission close", () => {
    expect(doitPasserEnPropositions("done", { answered: 3, total: 3 })).toBe(false);
  });
});

describe("doitEnchainer", () => {
  it("enchaîne un tick quand la phase vient de changer", () => {
    // Sinon la mission passe en propositions puis se tait jusqu'à ce qu'un
    // participant reprenne la parole.
    expect(doitEnchainer(true, 0)).toBe(true);
  });

  it("s'arrête à un seul maillon", () => {
    // Chaque maillon est un appel au modèle facturé au propriétaire du gent :
    // une chaîne non bornée serait une facture non bornée.
    expect(doitEnchainer(true, 1)).toBe(false);
    expect(doitEnchainer(true, 2)).toBe(false);
  });

  it("n'enchaîne pas sans changement de phase", () => {
    expect(doitEnchainer(false, 0)).toBe(false);
  });
});
