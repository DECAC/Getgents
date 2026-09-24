import { consigneArtefacts, ARTEFACT_PROMPT_INSTRUCTION, estFrequenceArtefacts } from "@/lib/artefactSignal";
import { artefactHomonyme, historiquePourModele, libelleGarder } from "@/lib/historiqueModele";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import { draftToEspace } from "@/lib/publishedGents";
import type { GentDraft } from "@/lib/types/builder";
import type { Artefact, ConversationMessage } from "@/lib/types";

function draft(partial: Partial<GentDraft> = {}): GentDraft {
  return {
    id: "g1",
    name: "Talk to Charles",
    icon: "✨",
    objective: "présenter Charles",
    systemPrompt: "Tu es l'avatar de Charles.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    ...partial,
  } as GentDraft;
}

describe("une seule consigne décide de l'artefact", () => {
  it("ne réclame plus d'artefact « systématiquement » ni « dans la majorité des réponses »", () => {
    for (const niveau of ["discret", "equilibre", "proactif"] as const) {
      const c = consigneArtefacts(niveau);
      expect(c).not.toMatch(/Propose systématiquement/i);
      expect(c).not.toMatch(/majorité des réponses/i);
      // Seconde contradiction, cachée dans la consigne du résumé de profil :
      // « dès que la conversation porte sur une personne, propose » — sur un
      // gent qui parle d'une personne, cela voulait dire à chaque tour.
      expect(c).not.toMatch(/dès que la conversation porte sur le parcours/i);
    }
  });

  it("la demande de l'utilisateur et la mémoire passent AVANT le niveau du créateur", () => {
    const c = consigneArtefacts("discret");
    const demande = c.indexOf("DEMANDE");
    const memoire = c.indexOf("Ne repropose JAMAIS");
    const niveau = c.indexOf("N'EN PROPOSE PAS");
    expect(demande).toBeGreaterThan(-1);
    expect(demande).toBeLessThan(memoire);
    expect(memoire).toBeLessThan(niveau);
  });

  it("les trois crans donnent trois seuils différents, « équilibré » par défaut", () => {
    const [d, e, p] = [consigneArtefacts("discret"), consigneArtefacts("equilibre"), consigneArtefacts("proactif")];
    expect(new Set([d, e, p]).size).toBe(3);
    expect(consigneArtefacts()).toBe(e);
    expect(ARTEFACT_PROMPT_INSTRUCTION).toBe(e);
  });

  it("n'accepte que les trois valeurs connues", () => {
    expect(estFrequenceArtefacts("proactif")).toBe(true);
    expect(estFrequenceArtefacts("toujours")).toBe(false);
    expect(estFrequenceArtefacts(undefined)).toBe(false);
  });

  it("le prompt assemblé d'un gent diffusé ne contient plus deux règles contraires", () => {
    const espace = draftToEspace(draft({ frequenceArtefacts: "discret" }));
    const prompt = buildGentSystemPrompt(espace, { variant: "sharedLink" });
    expect(prompt).not.toMatch(/uniquement quand le contenu de la conversation s'y prête/);
    expect(prompt).toContain("N'EN PROPOSE PAS");
    expect(prompt.match(/ARTEFACTS — /g)).toHaveLength(1);
  });

  it("un réglage inconnu n'est pas diffusé", () => {
    const espace = draftToEspace(draft({ frequenceArtefacts: "toujours" as never }));
    expect(espace.frequenceArtefacts).toBeUndefined();
  });
});

describe("mémoire des propositions dans l'historique", () => {
  const fil: ConversationMessage[] = [
    { role: "user", text: "Montre son parcours" },
    { role: "agent", text: "<p>Voici.</p>" },
    {
      id: "prop-1",
      role: "artef-proposal",
      proposal: { kind: "dashboard", title: "Parcours professionnel" },
      proposalStatus: "dismissed",
    },
    { role: "user", text: "Et ses compétences ?" },
    { role: "agent", text: "Les voici." },
    {
      id: "prop-2",
      role: "artef-proposal",
      proposal: { kind: "checklist", title: "Compétences clés" },
      proposalStatus: "added",
    },
    { role: "user", text: "Merci" },
  ];

  it("rattache chaque verdict à la réponse qui a proposé l'artefact", () => {
    const h = historiquePourModele(fil);
    expect(h.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(h[1].content).toBe("Voici.\n[Artefact proposé : « Parcours professionnel » (Tableau de bord) — jeté]");
    expect(h[3].content).toContain("[Artefact proposé : « Compétences clés » (Checklist) — gardé]");
  });

  it("dit « sans réponse » quand l'utilisateur n'a pas tranché", () => {
    const h = historiquePourModele([
      { role: "agent", text: "Voici." },
      { id: "p", role: "artef-proposal", proposal: { kind: "report", title: "Note" } },
    ]);
    expect(h[0].content).toContain("— sans réponse]");
  });

  it("signale un artefact perdu, pour qu'un réessai sache de quoi il s'agit", () => {
    const h = historiquePourModele([{ role: "agent", text: "Voici.", artefactEchec: "tronque" }]);
    expect(h[0].content).toContain("[Artefact annoncé mais perdu : réponse coupée]");
  });

  it("ignore les messages techniques (outils, cartes de consentement)", () => {
    const h = historiquePourModele([
      { role: "user", text: "Bonjour" },
      { role: "tool", kind: "MCP", what: "recherche", ok: true },
      { role: "geo-request" },
    ]);
    expect(h).toEqual([{ role: "user", content: "Bonjour" }]);
  });
});

describe("une retouche remplace au lieu de doublonner", () => {
  const gardes: Artefact[] = [
    { id: "a1", title: "Parcours professionnel", type: "Tableau de bord", icon: "📈", date: "hier" },
    { id: "visionneuse-doc", title: "Document", type: "Rapport", icon: "📄", date: "hier" },
  ];

  it("reconnaît le même titre, à la casse et aux espaces près", () => {
    expect(artefactHomonyme(gardes, "  parcours   PROFESSIONNEL ")?.id).toBe("a1");
    expect(artefactHomonyme(gardes, "Compétences")).toBeUndefined();
  });

  it("ne remplace jamais le document fixé par le créateur", () => {
    expect(artefactHomonyme(gardes, "Document")).toBeUndefined();
  });

  it("le bouton annonce le remplacement", () => {
    expect(libelleGarder(gardes, "Parcours professionnel")).toBe("Mettre à jour dans l'espace");
    expect(libelleGarder(gardes, "Autre")).toBe("Garder dans l'espace");
  });
});
