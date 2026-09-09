import { mesurerReponse, type ContexteReponse, type InstantsReponse } from "@/lib/chatTiming";

const ctx: ContexteReponse = {
  gentId: "g1",
  model: "anthropic/claude-sonnet-5",
  raisonnement: true,
  webSearch: false,
  systemChars: 48000,
  historique: 2,
  maxTokens: 4096,
};

describe("mesurerReponse", () => {
  it("mesure le silence avant le premier mot depuis le DÉBUT de la requête", () => {
    // C'est l'attente réelle du visiteur, notre préparation comprise. La
    // compter depuis l'appel au fournisseur masquerait le temps que nous
    // passons nous-mêmes à lire la base et assembler le prompt.
    const m = mesurerReponse(
      { debut: 1000, enTetes: 1400, premierJeton: 9000, fin: 15000 },
      ctx
    );
    expect(m.preparationMs).toBe(400);
    expect(m.premierJetonMs).toBe(8000);
    expect(m.totalMs).toBe(14000);
  });

  it("écrit null quand le flux n'a rien donné", () => {
    // Zéro se lirait comme « instantané ». Une réponse jamais venue n'est pas
    // une réponse rapide.
    const m = mesurerReponse({ debut: 1000, enTetes: 1200, premierJeton: null, fin: 3000 }, ctx);
    expect(m.premierJetonMs).toBeNull();
    expect(m.totalMs).toBe(2000);
  });

  it("survit à une horloge qui recule", () => {
    // Date.now() peut reculer sur un ajustement de l'hôte : un chiffre négatif
    // ferait douter de toute la mesure.
    const m = mesurerReponse({ debut: 5000, enTetes: 4000, premierJeton: 4500, fin: 4800 }, ctx);
    expect(m.preparationMs).toBe(0);
    expect(m.premierJetonMs).toBe(0);
  });

  it("porte les quatre causes possibles dans la même ligne", () => {
    // Modèle, raisonnement, taille du prompt, recherche web : sans elles
    // côte à côte, un chiffre lent ne désigne aucun coupable.
    const m = mesurerReponse({ debut: 0, enTetes: 1, premierJeton: 2, fin: 3 }, ctx);
    for (const cle of ["model", "raisonnement", "systemChars", "webSearch"] as const) {
      expect(m[cle]).toBeDefined();
    }
  });

  it("n'emporte aucun contenu de conversation", () => {
    // Le prompt système contient la base de connaissance du créateur : on
    // mesure sa taille, jamais son texte.
    const m = mesurerReponse({ debut: 0, enTetes: 1, premierJeton: 2, fin: 3 }, ctx);
    const texte = Object.entries(m).filter(
      ([k, v]) => typeof v === "string" && !["tag", "event", "gentId", "model"].includes(k)
    );
    expect(texte).toEqual([]);
  });
});
