import {
  BUILDER_FIRST_TOKEN_DEADLINE_MS,
  builderTurnBudget,
  needsWebSearch,
} from "@/lib/builderLatency";

describe("recherche web à la demande", () => {
  it("se déclenche sur une vraie recherche de source", () => {
    expect(needsWebSearch("trouve un connecteur pour les DPE")).toBe(true);
    expect(needsWebSearch("y a-t-il une API publique ?")).toBe(true);
    expect(needsWebSearch("regarde https://data.gouv.fr/…")).toBe(true);
    expect(needsWebSearch("un jeu de données sur les logements")).toBe(true);
  });

  it("ne se déclenche pas sur la configuration courante du gent", () => {
    // Ces tours n'ont besoin d'aucune source externe : la recherche n'y
    // ajoutait que de l'attente, avant même le premier caractère.
    expect(needsWebSearch("propose-moi un nom et un objectif")).toBe(false);
    expect(needsWebSearch("rends le ton plus direct")).toBe(false);
    expect(needsWebSearch("ajoute un onglet Citations")).toBe(false);
  });
});

describe("budget d'un tour", () => {
  const ctx = { userText: "propose une première configuration" };

  it("ne demande plus de réflexion visible, sur aucun tour", () => {
    for (const kind of ["cadrage", "apercu", "conversation"] as const) {
      expect(builderTurnBudget(kind, ctx).reasoning).toBe(false);
    }
  });

  it("coupe la recherche web partout sauf sur une vraie recherche de source", () => {
    expect(builderTurnBudget("conversation", ctx).webSearch).toBe(false);
    expect(builderTurnBudget("conversation", { userText: "cherche une API météo" }).webSearch).toBe(true);
    expect(builderTurnBudget("apercu", { userText: "cherche une API météo" }).webSearch).toBe(false);
    expect(builderTurnBudget("cadrage", { userText: "cherche une API météo" }).webSearch).toBe(false);
  });

  it("protège le tout premier tour, celui de la première proposition", () => {
    // L'objectif du gent peut parler d'API sans que ce tour ait à chercher
    // quoi que ce soit : c'est le moment où la réactivité compte le plus.
    const seed = { userText: "un gent qui surveille des API de transport", seedObjective: true };
    expect(builderTurnBudget("conversation", seed).webSearch).toBe(false);
  });

  it("garde les plafonds de sortie propres à chaque tour", () => {
    expect(builderTurnBudget("cadrage", ctx).maxTokens).toBe(1_200);
    expect(builderTurnBudget("apercu", ctx).maxTokens).toBe(6_000);
    expect(builderTurnBudget("conversation", ctx).maxTokens).toBe(16_000);
  });

  it("coupe tout sur le rejeu, quel que soit le tour", () => {
    const degraded = { userText: "cherche une API météo", degraded: true };
    for (const kind of ["cadrage", "apercu", "conversation"] as const) {
      expect(builderTurnBudget(kind, degraded)).toEqual({
        reasoning: false,
        webSearch: false,
        maxTokens: 4_000,
      });
    }
  });

  it("promet une première proposition en moins de trente secondes", () => {
    expect(BUILDER_FIRST_TOKEN_DEADLINE_MS).toBeLessThan(30_000);
  });
});
