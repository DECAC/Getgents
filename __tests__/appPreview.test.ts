import {
  buildAppPreviewEvolveRequest,
  buildAppPreviewEvolveSystemPrompt,
  buildAppPreviewSystemPrompt,
  extractAppPreviewSignal,
  mergeAppPreview,
  type AppPreviewSpec,
} from "@/lib/appPreview";
import { draftToEspace } from "@/lib/publishedGents";
import { draftContentSnapshot } from "@/lib/builderSnapshot";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { GentDraft } from "@/lib/types/builder";

function signal(json: unknown): string {
  return `Voici l'aperçu.\n<!--APERCU: ${JSON.stringify(json)}-->`;
}

const MINIMAL = {
  appName: "Radar emploi",
  themes: ["Mon profil", "Postes"],
  modules: [
    {
      id: "mini-cv",
      title: "Mon mini CV",
      theme: "Mon profil",
      size: "large",
      blocks: [{ kind: "text", text: "Cheffe de projet, 6 ans d'expérience." }],
    },
  ],
};

describe("extractAppPreviewSignal", () => {
  it("retire le bloc du texte visible et rend l'aperçu", () => {
    const { text, preview, replace } = extractAppPreviewSignal(signal(MINIMAL));
    expect(text).toBe("Voici l'aperçu.");
    expect(replace).toBe(false);
    expect(preview?.appName).toBe("Radar emploi");
    expect(preview?.modules).toHaveLength(1);
    expect(preview?.modules[0].id).toBe("mini-cv");
  });

  it("laisse le texte intact quand il n'y a pas de bloc", () => {
    const { text, preview } = extractAppPreviewSignal("Réponse sans aperçu.");
    expect(text).toBe("Réponse sans aperçu.");
    expect(preview).toBeNull();
  });

  it("ignore un bloc malformé sans casser la réponse", () => {
    const { text, preview } = extractAppPreviewSignal("Texte.\n<!--APERCU: {oops-->");
    expect(preview).toBeNull();
    expect(text).toContain("Texte.");
  });

  it("écarte les blocs inconnus et les modules qui n'en gardent aucun", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue"],
        modules: [
          { id: "vide", title: "Module vide", theme: "Vue", size: "standard", blocks: [{ kind: "iframe", src: "http://x" }] },
          {
            id: "ok",
            title: "Module valide",
            theme: "Vue",
            size: "standard",
            blocks: [
              { kind: "iframe", src: "http://x" },
              { kind: "stats", items: [{ value: "12", label: "Offres" }] },
            ],
          },
        ],
      })
    );
    expect(preview?.modules.map((m) => m.id)).toEqual(["ok"]);
    expect(preview?.modules[0].blocks).toHaveLength(1);
  });

  it("rattache un module rangé dans un onglet non déclaré", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue d'ensemble"],
        modules: [
          {
            id: "orphelin",
            title: "Orphelin",
            theme: "Onglet fantôme",
            size: "standard",
            blocks: [{ kind: "text", text: "Contenu." }],
          },
        ],
      })
    );
    expect(preview?.themes).toContain(preview?.modules[0].theme);
  });

  it("normalise une taille invalide et fabrique un id depuis le titre", () => {
    const { preview } = extractAppPreviewSignal(
      signal({
        themes: ["Vue"],
        modules: [{ title: "Dépenses à surveiller", theme: "Vue", size: "gigantesque", blocks: [{ kind: "text", text: "…" }] }],
      })
    );
    expect(preview?.modules[0].size).toBe("standard");
    expect(preview?.modules[0].id).toBe("depenses-a-surveiller");
  });

  it("accepte un commentaire avec espaces et sans --> final", () => {
    const { preview, text } = extractAppPreviewSignal(
      `Phrase.\n<!-- APERCU: ${JSON.stringify(MINIMAL)}`
    );
    expect(preview?.appName).toBe("Radar emploi");
    expect(text).toBe("Phrase.");
  });

  it("attend la fin du JSON pendant un flux tronqué", () => {
    const { preview, text } = extractAppPreviewSignal('Voici.\n<!--APERCU: {"appName":"X","themes":["A"],"modules":[');
    expect(preview).toBeNull();
    expect(text).toBe("Voici.");
  });

  it("accepte un objet JSON dans une clôture markdown", () => {
    const { preview } = extractAppPreviewSignal("Voici.\n```json\n" + JSON.stringify(MINIMAL) + "\n```");
    expect(preview?.appName).toBe("Radar emploi");
  });
});

describe("buildAppPreviewSystemPrompt", () => {
  it("reste centré sur l'aperçu, sans envoyer configurer le gent", () => {
    const prompt = buildAppPreviewSystemPrompt({
      name: "Radar",
      objective: "suivre des candidatures",
      connectors: [{ name: "Adzuna" }],
    });
    expect(prompt).toMatch(/UNIQUEMENT l'aperçu/i);
    expect(prompt).toContain("suivre des candidatures");
    expect(prompt).toContain("Adzuna");
    expect(prompt).toMatch(/Interdit : GENT_CONFIG/);
    expect(prompt).toMatch(/bloc actions/i);
    expect(prompt).not.toMatch(/découvrir des connecteurs/i);
  });
});

describe("évolution de l'aperçu par propositions", () => {
  const spec: AppPreviewSpec = {
    appName: "Radar",
    themes: ["Mon profil", "Postes"],
    modules: [
      { id: "mini-cv", title: "Mon mini CV", theme: "Mon profil", size: "large", blocks: [{ kind: "text", text: "x" }] },
    ],
  };

  it("demande des options cliquables, pas une régénération immédiate", () => {
    const req = buildAppPreviewEvolveRequest(spec);
    expect(req).toContain("Mon mini CV");
    expect(req).toMatch(/QUESTIONS/);
    expect(req).toMatch(/N'émet PAS de bloc APERCU/i);
    expect(req).toMatch(/Autre/);
    expect(req).not.toMatch(/Émets le bloc APERCU en premier/);
  });

  it("interdit APERCU et Autre dans le prompt système du tour de choix", () => {
    const prompt = buildAppPreviewEvolveSystemPrompt({
      name: "Radar",
      objective: "candidatures",
      appPreview: spec,
    });
    expect(prompt).toMatch(/FAIRE ÉVOLUER/i);
    expect(prompt).toContain("QUESTIONS");
    expect(prompt).toMatch(/N'inclus PAS « Autre »/);
    expect(prompt).toMatch(/Interdit : APERCU/);
    expect(prompt).toMatch(/liste à puces/);
    expect(prompt).not.toMatch(/émets d'abord le bloc <!--APERCU/);
    expect(prompt).not.toContain("APP_PREVIEW");
  });
});

describe("mergeAppPreview", () => {
  const current: AppPreviewSpec = {
    themes: ["A", "B"],
    modules: [
      { id: "m1", title: "Un", theme: "A", size: "standard", blocks: [{ kind: "text", text: "un" }] },
      { id: "m2", title: "Deux", theme: "B", size: "standard", blocks: [{ kind: "text", text: "deux" }] },
    ],
  };

  it("remplace un module de même id sans le déplacer", () => {
    const incoming: AppPreviewSpec = {
      themes: ["A"],
      modules: [{ id: "m1", title: "Un (v2)", theme: "A", size: "large", blocks: [{ kind: "text", text: "maj" }] }],
    };
    const merged = mergeAppPreview(current, incoming, false);
    expect(merged.modules.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(merged.modules[0].title).toBe("Un (v2)");
  });

  it("ajoute un module nouveau et son onglet", () => {
    const incoming: AppPreviewSpec = {
      themes: ["C"],
      modules: [{ id: "m3", title: "Trois", theme: "C", size: "compact", blocks: [{ kind: "text", text: "trois" }] }],
    };
    const merged = mergeAppPreview(current, incoming, false);
    expect(merged.modules).toHaveLength(3);
    expect(merged.themes).toEqual(["A", "B", "C"]);
  });

  it("repart de zéro quand replace est demandé", () => {
    const incoming: AppPreviewSpec = {
      themes: ["Z"],
      modules: [{ id: "z", title: "Zéro", theme: "Z", size: "full", blocks: [{ kind: "text", text: "z" }] }],
    };
    expect(mergeAppPreview(current, incoming, true).modules.map((m) => m.id)).toEqual(["z"]);
  });

  it("oublie les onglets qui ne portent plus aucun module", () => {
    const merged = mergeAppPreview(
      { themes: ["A", "Vide"], modules: current.modules },
      { themes: [], modules: [] },
      false
    );
    expect(merged.themes).toEqual(["A", "B"]);
  });
});

describe("passage de l'aperçu à l'espace (Preview)", () => {
  const spec: AppPreviewSpec = {
    appName: "Radar candidatures",
    themes: ["Mon profil"],
    modules: [
      {
        id: "mini-cv",
        title: "Mon mini CV",
        theme: "Mon profil",
        size: "large",
        blocks: [{ kind: "text", text: "Camille, 6 ans." }],
      },
    ],
  };

  function draft(appPreview?: AppPreviewSpec): GentDraft {
    return {
      id: "g1",
      name: "Radar",
      icon: "🧭",
      objective: "suivre des candidatures",
      systemPrompt: "Tu aides à candidater.",
      status: "draft",
      updatedAt: "à l'instant",
      modelAssignments: [],
      knowledgeSources: [],
      connectors: [],
      builderConversation: [],
      appPreview,
    };
  }

  it("copie l'aperçu dans l'espace publié, pour que Preview l'affiche", () => {
    const espace = draftToEspace(draft(spec));
    expect(espace.appPreview?.appName).toBe("Radar candidatures");
    expect(espace.appPreview?.modules.map((m) => m.id)).toEqual(["mini-cv"]);
  });

  it("n'invente pas d'aperçu si le brouillon n'en a pas", () => {
    expect(draftToEspace(draft()).appPreview).toBeUndefined();
  });

  it("fait partie de l'empreinte de publication", () => {
    const without = draftContentSnapshot(draft());
    const withPreview = draftContentSnapshot(draft(spec));
    expect(without).not.toEqual(withPreview);
    expect(withPreview).toContain("mini-cv");
  });

  it("est transmis au destinataire d'un lien de partage", () => {
    const pub = espaceForPublicLink(draftToEspace(draft(spec)));
    expect(pub.appPreview?.appName).toBe("Radar candidatures");
  });
});

/**
 * Régression signalée en test : un onglet « Citations » apparaissait, mais
 * vide. Le modèle avait émis des blocs `{"kind":"quote"}` — hors catalogue,
 * donc silencieusement jetés, ne laissant que le titre et les boutons. Pire :
 * un module ré-émis dont TOUS les blocs échouaient était rejeté en entier,
 * l'ancien restait à l'écran, et l'assistant annonçait quand même la
 * modification. On rattrape désormais les synonymes et les formes voisines.
 */
describe("rattrapage des blocs hors catalogue", () => {
  function blocks(raw: unknown[]) {
    const { preview } = extractAppPreviewSignal(
      `<!--APERCU: ${JSON.stringify({
        themes: ["Citations"],
        modules: [{ id: "m", title: "T", theme: "Citations", size: "large", blocks: raw }],
      })}-->`
    );
    return preview?.modules[0].blocks ?? [];
  }

  it("traduit un synonyme de kind plutôt que de jeter le bloc", () => {
    expect(blocks([{ kind: "quote", text: "« Le premier extrait. »" }])).toEqual([
      { kind: "text", text: "« Le premier extrait. »" },
    ]);
    expect(blocks([{ kind: "kpi", items: [{ value: "12", label: "Extraits" }] }])[0].kind).toBe("stats");
  });

  it("accepte les noms de champ voisins", () => {
    expect(blocks([{ kind: "text", content: "Un paragraphe." }])).toEqual([
      { kind: "text", text: "Un paragraphe." },
    ]);
    expect(blocks([{ kind: "actions", items: [{ label: "Ouvrir" }] }])).toEqual([
      { kind: "actions", items: ["Ouvrir"] },
    ]);
  });

  it("devine le type d'après la forme quand le kind est inconnu", () => {
    expect(blocks([{ kind: "citations", items: [{ title: "Page 12", note: "…" }] }])[0].kind).toBe("cards");
    expect(blocks([{ kind: "n-importe-quoi", columns: ["A"], rows: [["1"]] }])[0].kind).toBe("table");
  });

  it("rejette encore ce qui ne porte aucune donnée exploitable", () => {
    expect(blocks([{ kind: "quote" }, { kind: "mystere", foo: 1 }])).toEqual([]);
  });

  it("laisse passer une modification qui n'utilise que des synonymes", () => {
    // Le cas signalé : sans rattrapage, ce module était rejeté en entier.
    const { preview } = extractAppPreviewSignal(
      `<!--APERCU: ${JSON.stringify({
        themes: ["Citations"],
        modules: [
          {
            id: "citations",
            title: "Citations clés",
            theme: "Citations",
            blocks: [{ kind: "quotes", items: ["Extrait A", "Extrait B", "Extrait C"] }],
          },
        ],
      })}-->`
    );
    expect(preview?.modules[0].blocks).toHaveLength(1);
  });
});
