import { draftToEspace } from "@/lib/publishedGents";
import type { GentDraft } from "@/lib/types/builder";

// Le bug rapporté : un gent « avatar » configuré avec un livre blanc en base
// de connaissance ne répondait qu'en extrapolant depuis le NOM du fichier —
// le contenu n'était jamais transmis au modèle, seulement une ligne de
// référence. draftToEspace doit désormais injecter le texte réel.

function draft(knowledgeSources: GentDraft["knowledgeSources"]): GentDraft {
  return {
    id: "avatar-test",
    name: "Avatar",
    icon: "🧑",
    objective: "Répondre à partir du livre blanc",
    systemPrompt: "Tu es l'avatar de Charles.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources,
    connectors: [],
    builderConversation: [],
  } as unknown as GentDraft;
}

describe("injection du contenu de la base de connaissance", () => {
  it("transmet le texte réel du document, pas seulement son nom", () => {
    const espace = draftToEspace(
      draft([
        {
          id: "k1",
          kind: "file",
          label: "LIVRE BLANC - ADOPTION DE L'IA.docx",
          meta: "1,2 Mo",
          text: "Chapitre 1 : la maturité IA des organisations passe par trois étapes clés.",
        },
      ])
    );
    expect(espace.systemPrompt).toContain("BASE DE CONNAISSANCE");
    expect(espace.systemPrompt).toContain("la maturité IA des organisations passe par trois étapes");
    expect(espace.systemPrompt).toContain("LIVRE BLANC - ADOPTION DE L'IA.docx");
  });

  it("retombe en référence seule quand aucun texte n'a été extrait (URL, échec d'extraction)", () => {
    const espace = draftToEspace(
      draft([{ id: "k1", kind: "url", label: "https://exemple.fr/rapport", meta: "Ajouté à l'instant" }])
    );
    expect(espace.systemPrompt).toContain("Autres références déclarées");
    expect(espace.systemPrompt).toContain("url : https://exemple.fr/rapport");
    expect(espace.systemPrompt).not.toContain("BASE DE CONNAISSANCE DÉCLARÉE");
  });

  it("combine contenu réel et références seules dans le même gent", () => {
    const espace = draftToEspace(
      draft([
        { id: "k1", kind: "file", label: "livre.docx", meta: "1 Mo", text: "Contenu du livre." },
        { id: "k2", kind: "url", label: "https://exemple.fr", meta: "Ajouté" },
      ])
    );
    expect(espace.systemPrompt).toContain("Contenu du livre.");
    expect(espace.systemPrompt).toContain("url : https://exemple.fr");
  });

  it("respecte le budget total et nomme ce qui est écarté", () => {
    const gros = "x".repeat(40_000);
    const espace = draftToEspace(
      draft([
        { id: "k1", kind: "file", label: "premier.docx", meta: "1 Mo", text: gros },
        { id: "k2", kind: "file", label: "second.docx", meta: "1 Mo", text: "y".repeat(10_000) },
      ])
    );
    expect(espace.systemPrompt).toContain("premier.docx");
    expect(espace.systemPrompt).toContain("second.docx (non inclus faute de place)");
  });

  it("ne dit plus que le contenu n'est jamais analysé", () => {
    const espace = draftToEspace(
      draft([{ id: "k1", kind: "file", label: "livre.docx", meta: "1 Mo", text: "Contenu réel." }])
    );
    expect(espace.systemPrompt).not.toContain("n'est pas analysé automatiquement");
  });

  it("ne place jamais ce contenu dans Espace.files — réservé aux documents de l'utilisateur final", () => {
    const espace = draftToEspace(
      draft([{ id: "k1", kind: "file", label: "livre.docx", meta: "1 Mo", text: "Contenu confidentiel du créateur." }])
    );
    expect(espace.files.every((f) => !("text" in f) || !f.text)).toBe(true);
    expect(JSON.stringify(espace.files)).not.toContain("Contenu confidentiel");
  });

  it("n'ajoute rien sans source déclarée", () => {
    const espace = draftToEspace(draft([]));
    expect(espace.systemPrompt).not.toContain("BASE DE CONNAISSANCE");
    expect(espace.systemPrompt).not.toContain("Autres références");
  });
});

describe("ordre du prompt système publié", () => {
  const CREATOR = "Tu es La Gargoulais. STYLE : réponses COURTES, 80 mots maximum.";

  function draftWith(overrides: Partial<Parameters<typeof draftToEspace>[0]> = {}) {
    return {
      id: "g1",
      name: "La Gargoulais",
      icon: "🏡",
      objective: "",
      systemPrompt: CREATOR,
      status: "published" as const,
      updatedAt: "à l'instant",
      modelAssignments: [],
      knowledgeSources: [],
      connectors: [],
      builderConversation: [],
      ...overrides,
    };
  }

  it("termine par le prompt du créateur, même avec base de connaissance et connecteurs", () => {
    // Régression : les blocs de plateforme (base de connaissance, formats
    // d'artefact, modes d'emploi des connecteurs) étaient concaténés APRÈS le
    // prompt du créateur. Ils occupaient donc la dernière position — celle que
    // le modèle lit comme faisant autorité — et son style passait au second
    // plan derrière des consignes purement techniques.
    const espace = draftToEspace(
      draftWith({
        webSearch: true,
        knowledgeSources: [
          { id: "k1", kind: "file", label: "DPE.pdf", meta: "1 Mo", text: "Contenu du diagnostic" },
        ],
        connectors: [
          {
            id: "c1",
            toolKind: "dataset",
            name: "DVF",
            detail: "https://public.opendatasoft.com/explore/dataset/dvf/",
          },
        ],
      })
    );
    expect(espace.systemPrompt?.trimEnd().endsWith(CREATOR)).toBe(true);
  });

  it("conserve les blocs de plateforme, seulement déplacés avant", () => {
    const espace = draftToEspace(
      draftWith({
        knowledgeSources: [
          { id: "k1", kind: "file", label: "DPE.pdf", meta: "1 Mo", text: "Contenu du diagnostic" },
        ],
      })
    );
    expect(espace.systemPrompt).toContain("Contenu du diagnostic");
    expect(espace.systemPrompt).toContain("Génère des artefacts");
    expect(espace.systemPrompt!.indexOf("Contenu du diagnostic")).toBeLessThan(
      espace.systemPrompt!.indexOf(CREATOR)
    );
  });
});
