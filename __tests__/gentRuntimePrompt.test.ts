import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import type { Espace } from "@/lib/types";

const CREATOR_PROMPT =
  "Tu es La Gargoulais. STYLE : réponses COURTES, 80 mots maximum, jamais davantage.";

function espace(partial: Partial<Espace> = {}): Espace {
  return {
    icon: "🏡",
    name: "La Gargoulais",
    gent: "Compagnon Immobilier",
    version: 1,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "",
    conversations: [],
    activeConversationId: "c1",
    files: [],
    artefacts: [],
    systemPrompt: CREATOR_PROMPT,
    ...partial,
  } as Espace;
}

describe("assemblage du message système d'un gent", () => {
  it("place le prompt du créateur EN DERNIER, dans les deux variantes", () => {
    // Régression : la machinerie de plateforme (artefacts, suggestions…) était
    // placée après le prompt du créateur. Lue en dernier, elle primait sur son
    // style — d'où des réponses longues là où il en demandait de courtes.
    for (const variant of ["espace", "sharedLink"] as const) {
      const prompt = buildGentSystemPrompt(espace(), { variant });
      expect(prompt.trimEnd().endsWith(CREATOR_PROMPT)).toBe(true);
    }
  });

  it("annonce explicitement que les consignes du créateur priment sur la longueur", () => {
    const prompt = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    expect(prompt).toContain("priment sur tout ce qui précède");
    expect(prompt).toContain("LONGUEUR");
  });

  it("donne le format d'artefact dans les deux variantes", () => {
    // Régression : le chemin « lien de partage » invitait le gent à produire
    // des artefacts sans jamais lui donner le format du bloc — il n'en
    // produisait donc aucun, ni aucun JSON encapsulé.
    for (const variant of ["espace", "sharedLink"] as const) {
      const prompt = buildGentSystemPrompt(espace(), { variant });
      expect(prompt).toContain("<!--ARTEFACT:");
    }
  });

  it("ne laisse fuir ni la mémoire ni les documents du créateur par un lien", () => {
    const withContext = espace({
      memory: "Note privée du créateur",
      files: [{ id: "f1", name: "cv.pdf", size: "1 Ko", date: "hier", text: "CONTENU CONFIDENTIEL" }],
    });
    const shared = buildGentSystemPrompt(withContext, { variant: "sharedLink" });
    expect(shared).not.toContain("Note privée du créateur");
    expect(shared).not.toContain("CONTENU CONFIDENTIEL");

    // Chez son propriétaire, en revanche, ce contexte doit bien être présent.
    const own = buildGentSystemPrompt(withContext, { variant: "espace" });
    expect(own).toContain("Note privée du créateur");
  });

  it("prévient l'invité qu'il n'est pas le créateur", () => {
    const shared = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    expect(shared).toContain("invité");
    expect(buildGentSystemPrompt(espace(), { variant: "espace" })).not.toContain("invité qui a reçu un lien");
  });

  it("pose le garde-fou anti-hallucination seulement sans source réelle", () => {
    expect(buildGentSystemPrompt(espace(), { variant: "espace" })).toContain("AUCUNE source de données temps réel");
    const connected = espace({ webSearch: true });
    expect(buildGentSystemPrompt(connected, { variant: "espace" })).not.toContain(
      "AUCUNE source de données temps réel"
    );
  });

  it("réserve à l'espace les mécanismes qui réorganisent l'espace de l'utilisateur", () => {
    const shared = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    const own = buildGentSystemPrompt(espace(), { variant: "espace" });
    expect(own).toContain("<!--PROFILE:");
    expect(shared).not.toContain("<!--PROFILE:");
  });

  it("injecte les consignes d'illustration (génération + photo web)", () => {
    const prompt = buildGentSystemPrompt(espace(), { variant: "espace" });
    expect(prompt).toContain('<!--IMAGE: {"kind":"generate"');
    expect(prompt).toContain('<!--IMAGE: {"kind":"web"');
  });
});

describe("consigne de langue", () => {
  it("est présente dans toutes les variantes", () => {
    // Un gent doit se comporter pareil chez son créateur et derrière un lien.
    for (const variant of ["espace", "sharedLink", "superGent"] as const) {
      expect(buildGentSystemPrompt(espace(), { variant })).toMatch(/^LANGUE —/m);
    }
  });

  it("précède les instructions du créateur", () => {
    // Celles-ci « priment sur tout ce qui précède » : placée après, la
    // consigne de langue pourrait être lue comme les contredisant. Elle ne les
    // contredit pas — elle dit dans quelle langue les appliquer.
    const p = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    expect(p.indexOf("LANGUE —")).toBeLessThan(p.indexOf("INSTRUCTIONS DU GENT"));
  });

  it("reprend la langue du navigateur quand elle est fournie", () => {
    const p = buildGentSystemPrompt(espace(), { variant: "sharedLink", langueNavigateur: "es" });
    expect(p).toMatch(/espagnol/);
  });
});

describe("règle d'exactitude", () => {
  it("est présente dans toutes les variantes", () => {
    for (const variant of ["espace", "sharedLink", "superGent"] as const) {
      expect(buildGentSystemPrompt(espace(), { variant })).toMatch(/^EXACTITUDE —/m);
    }
  });

  it("préfère explicitement une réponse courte à une réponse fausse", () => {
    // Un gent qui invente pour paraître complet détruit la confiance en une
    // phrase ; un aveu d'ignorance appelle une question de plus.
    const p = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    expect(p).toMatch(/courte et sûre vaut mieux/i);
    expect(p).toMatch(/N'invente jamais/i);
  });
});

describe("ordre des sources", () => {
  it("ordonne le corpus avant la recherche web", () => {
    const p = buildGentSystemPrompt(espace(), { variant: "sharedLink" });
    expect(p).toMatch(/ORDRE DES SOURCES/);
    expect(p).toMatch(/base de connaissance D'ABORD/);
  });

  it("interdit de chercher pour confirmer ce qu'il sait deja", () => {
    expect(buildGentSystemPrompt(espace(), { variant: "sharedLink" })).toMatch(/jamais pour confirmer/);
  });

  it("place l'ordre des sources AVANT les instructions du createur", () => {
    const p = buildGentSystemPrompt(espace({ systemPrompt: "MARQUEUR_CREATEUR" }), { variant: "sharedLink" });
    expect(p.indexOf("ORDRE DES SOURCES")).toBeLessThan(p.indexOf("MARQUEUR_CREATEUR"));
  });
});
