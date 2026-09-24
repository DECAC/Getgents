import {
  appliquerMemoireVisiteur,
  cleMemoireVisiteur,
  extraireMemoireVisiteur,
  lireMemoireVisiteur,
} from "@/lib/memoireVisiteur";
import type { Artefact, Espace } from "@/lib/types";

function artef(id: string, title = id): Artefact {
  return { id, title, type: "Rapport", icon: "📄", date: "à l'instant" };
}

function diffuse(partial: Partial<Espace> = {}): Espace {
  return {
    icon: "✨",
    name: "Talk to Charles",
    gent: "Talk to Charles",
    version: 3,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "",
    conversations: [{ id: "shared", startedAt: "maintenant", messages: [] }],
    activeConversationId: "shared",
    files: [],
    artefacts: [artef("visionneuse-doc", "Document du créateur")],
    ...partial,
  };
}

describe("mémoire du visiteur d'un lien", () => {
  it("ne garde QUE ce que le visiteur a ajouté, pas les artefacts du créateur", () => {
    const servi = diffuse();
    const apres: Espace = {
      ...servi,
      artefacts: [artef("artef-1", "Parcours professionnel"), ...servi.artefacts],
      themeTabs: [{ id: "theme-1", label: "Parcours professionnel", moduleIds: ["artef-artef-1"] }],
      conversations: [
        {
          id: "shared",
          startedAt: "maintenant",
          messages: [
            { role: "user", text: "Montre son parcours" },
            { role: "agent", text: "Voici.", reasoning: "long raisonnement" },
          ],
        },
      ],
    };
    const m = extraireMemoireVisiteur(apres, servi);
    expect(m.artefacts.map((a) => a.id)).toEqual(["artef-1"]);
    expect(m.themeTabs).toHaveLength(1);
    // Le raisonnement pèse lourd et n'est presque jamais relu.
    expect(m.conversations[0].messages[1].reasoning).toBeUndefined();
    expect(m.conversations[0].messages[1].text).toBe("Voici.");
  });

  it("aller-retour : un rechargement rend la conversation et les artefacts gardés", () => {
    const servi = diffuse();
    const apres: Espace = {
      ...servi,
      artefacts: [artef("artef-1"), ...servi.artefacts],
      themeTabs: [{ id: "theme-1", label: "Artef-1", moduleIds: ["artef-artef-1"] }],
      conversations: [{ id: "shared", startedAt: "maintenant", messages: [{ role: "user", text: "Bonjour" }] }],
    };
    const stocke = JSON.stringify(extraireMemoireVisiteur(apres, servi));
    const relu = lireMemoireVisiteur(stocke);
    expect(relu).not.toBeNull();
    const restaure = appliquerMemoireVisiteur(diffuse(), relu!);
    expect(restaure.artefacts.map((a) => a.id)).toEqual(["artef-1", "visionneuse-doc"]);
    expect(restaure.conversations[0].messages[0].text).toBe("Bonjour");
    expect(restaure.themeTabs?.[0].moduleIds).toEqual(["artef-artef-1"]);
  });

  it("une rediffusion du créateur passe devant la copie : pas de doublon", () => {
    // Le créateur diffuse à son tour un artefact de même id : c'est le sien
    // qui fait foi, la copie du visiteur est écartée.
    const memoire = extraireMemoireVisiteur(
      { ...diffuse(), artefacts: [artef("artef-1", "copie visiteur"), artef("visionneuse-doc")] },
      diffuse()
    );
    const rediffuse = diffuse({ artefacts: [artef("artef-1", "version du créateur")] });
    const restaure = appliquerMemoireVisiteur(rediffuse, memoire);
    expect(restaure.artefacts.map((a) => a.title)).toEqual(["version du créateur"]);
  });

  it("fond l'onglet du visiteur dans celui du créateur qui porte le même nom", () => {
    const memoire = extraireMemoireVisiteur(
      {
        ...diffuse(),
        artefacts: [artef("artef-1"), artef("visionneuse-doc")],
        themeTabs: [{ id: "theme-v", label: "parcours", moduleIds: ["artef-artef-1"] }],
      },
      diffuse()
    );
    const servi = diffuse({ themeTabs: [{ id: "theme-c", label: "Parcours", moduleIds: ["tab-x"] }] });
    const restaure = appliquerMemoireVisiteur(servi, memoire);
    expect(restaure.themeTabs).toEqual([{ id: "theme-c", label: "Parcours", moduleIds: ["tab-x", "artef-artef-1"] }]);
  });

  it("ignore une valeur corrompue ou d'une autre version", () => {
    expect(lireMemoireVisiteur(null)).toBeNull();
    expect(lireMemoireVisiteur("{pas du json")).toBeNull();
    expect(lireMemoireVisiteur(JSON.stringify({ v: 99, conversations: [] }))).toBeNull();
  });

  it("une clé par lien : deux gents ne se mélangent pas", () => {
    expect(cleMemoireVisiteur("abc")).not.toBe(cleMemoireVisiteur("def"));
  });
});
