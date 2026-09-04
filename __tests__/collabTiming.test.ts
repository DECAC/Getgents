import { mesurerTick, type ContexteTick, type InstantsTick } from "@/lib/collabTiming";

const ctx: ContexteTick = {
  sessionId: "s1",
  phase: "collecting",
  model: "anthropic/claude-sonnet-5",
  webSearch: false,
  systemChars: 4200,
  etatChars: 1800,
  messages: 12,
  participants: 3,
  orchestration: 4,
  maxOrchestrations: 40,
  issue: "ok",
  actions: 2,
};

describe("mesurerTick", () => {
  it("sépare le temps du modèle du reste", () => {
    // C'est LA mesure qui décide de la suite : si le modèle pèse 95 %,
    // changer de modèle sert ; sinon on optimiserait au mauvais endroit.
    const m = mesurerTick({ debut: 1000, llmDebut: 1200, llmFin: 9200, fin: 9500 }, ctx);
    expect(m.totalMs).toBe(8500);
    expect(m.llmMs).toBe(8000);
    expect(m.autreMs).toBe(500);
    expect(m.llmPart).toBe(94);
  });

  it("écrit null, jamais zéro, quand le modèle n'a pas été appelé", () => {
    // Zéro se lirait comme « le modèle a répondu instantanément » — faux, et
    // ça enverrait chercher la lenteur ailleurs.
    const m = mesurerTick(
      { debut: 1000, llmDebut: null, llmFin: null, fin: 1050 },
      { ...ctx, issue: "quota", actions: null }
    );
    expect(m.llmMs).toBeNull();
    expect(m.autreMs).toBeNull();
    expect(m.llmPart).toBeNull();
    expect(m.totalMs).toBe(50);
  });

  it("écrit null si l'appel a commencé sans finir", () => {
    // Cas d'une exception au milieu de la génération : une durée partielle
    // serait pire qu'une absence, elle sous-estimerait le modèle.
    const m = mesurerTick(
      { debut: 1000, llmDebut: 1200, llmFin: null, fin: 5000 },
      { ...ctx, issue: "failed", actions: null }
    );
    expect(m.llmMs).toBeNull();
  });

  it("additionne la taille réellement envoyée", () => {
    // Le prompt grossit à chaque message du salon : c'est la deuxième
    // hypothèse de lenteur, et elle se lit dans cette seule colonne.
    const m = mesurerTick({ debut: 0, llmDebut: 1, llmFin: 2, fin: 3 }, ctx);
    expect(m.promptChars).toBe(6000);
  });

  it("ne laisse jamais passer une durée négative", () => {
    // Date.now() peut reculer (ajustement d'horloge sur la machine hôte). Un
    // chiffre négatif dans les journaux ferait douter de toute la mesure.
    const m = mesurerTick({ debut: 5000, llmDebut: 5000, llmFin: 4000, fin: 4000 }, ctx);
    expect(m.totalMs).toBe(0);
    expect(m.llmMs).toBe(0);
    expect(m.llmPart).toBeNull();
  });

  it("porte un tag et un événement stables", () => {
    // Les journaux se filtrent là-dessus ; les renommer casserait la lecture.
    const m = mesurerTick({ debut: 0, llmDebut: 0, llmFin: 1, fin: 1 }, ctx);
    expect(m.tag).toBe("getgents:collab");
    expect(m.event).toBe("orchestrator_tick");
  });

  it("n'emporte aucun contenu de conversation", () => {
    // Un salon contient des échanges privés. On mesure des longueurs, jamais
    // du texte : ce test garde l'invariant si quelqu'un ajoute un champ.
    const m = mesurerTick({ debut: 0, llmDebut: 0, llmFin: 1, fin: 1 }, ctx);
    const suspect = Object.entries(m).filter(
      ([cle, v]) => typeof v === "string" && !["tag", "event", "sessionId", "phase", "model", "issue"].includes(cle)
    );
    expect(suspect).toEqual([]);
  });
});
