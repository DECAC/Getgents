import { extractArtefactSignal } from "@/lib/artefactSignal";
import {
  artefactModuleId,
  extractThemeTabSignal,
  themeActionWithArtefact,
  upsertArtefactThemeTab,
} from "@/lib/themeTabSignal";
import type { Artefact, ThemeTab } from "@/lib/types";

function artef(id: string, type: string, title = "Titre"): Artefact {
  return { id, title, type, icon: "📄", date: "à l'instant" };
}

describe("artefactModuleId", () => {
  it("suit le format ModuleCanvas artef-<id>", () => {
    expect(artefactModuleId("artef-123")).toBe("artef-artef-123");
    expect(artefactModuleId("a1")).toBe("artef-a1");
  });
});

describe("upsertArtefactThemeTab", () => {
  it("nomme l'onglet d'après le CONTENU, pas d'après le type", () => {
    const next = upsertArtefactThemeTab(
      [],
      artef("a1", "Tableau de bord", "Parcours professionnel — Charles de Cassan")
    );
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe("Parcours professionnel");
    expect(next[0].moduleIds).toEqual(["artef-a1"]);
  });

  it("ne range pas deux sujets différents sous le même onglet parce qu'ils partagent un type", () => {
    let tabs = upsertArtefactThemeTab([], artef("a1", "Tableau de bord", "Parcours professionnel"));
    tabs = upsertArtefactThemeTab(tabs, artef("a2", "Tableau de bord", "Compétences clés"));
    expect(tabs.map((t) => t.label)).toEqual(["Parcours professionnel", "Compétences clés"]);
  });

  it("écarte la partie du titre qui ne fait que répéter le nom du gent", () => {
    const next = upsertArtefactThemeTab([], artef("a1", "Rapport", "Road trip Maroc — Budget"), ["Road trip Maroc"]);
    expect(next[0].label).toBe("Budget");
  });

  it("réutilise un onglet existant du même nom (insensible à la casse)", () => {
    const existing: ThemeTab[] = [{ id: "theme-1", label: "note de synthèse", moduleIds: ["tab-x"] }];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Rapport", "Note de synthèse"));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("theme-1");
    expect(next[0].moduleIds).toEqual(["tab-x", "artef-a1"]);
  });

  it("n'ajoute pas deux fois le même module", () => {
    const existing: ThemeTab[] = [{ id: "theme-1", label: "Titre", moduleIds: ["artef-a1"] }];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Rapport"));
    expect(next[0].moduleIds).toEqual(["artef-a1"]);
  });

  it("retire le module d'un autre onglet avant de le ranger", () => {
    const existing: ThemeTab[] = [
      { id: "theme-old", label: "Autre", moduleIds: ["artef-a1"] },
      { id: "theme-1", label: "Titre", moduleIds: ["tab-x"] },
    ];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Checklist"));
    expect(next.find((t) => t.id === "theme-old")).toBeUndefined();
    expect(next.find((t) => t.id === "theme-1")?.moduleIds).toEqual(["tab-x", "artef-a1"]);
  });

  it("retombe sur le type quand l'artefact n'a pas de titre", () => {
    expect(upsertArtefactThemeTab([], artef("a1", "Checklist", ""))[0].label).toBe("Checklist");
  });
});

describe("themeActionWithArtefact", () => {
  it("greffe l'id du nouvel artefact sur un create", () => {
    const action = themeActionWithArtefact(
      { action: "create", label: "Voyage", moduleIds: ["tab-1"] },
      "a1"
    );
    expect(action).toEqual({ action: "create", label: "Voyage", moduleIds: ["tab-1", "artef-a1"] });
  });

  it("laisse rename et delete inchangés", () => {
    const rename = { action: "rename" as const, tabId: "theme-1", label: "Nouveau" };
    expect(themeActionWithArtefact(rename, "a1")).toEqual(rename);
  });
});

describe("ARTEFACT + THEME_TAB dans la même réponse", () => {
  it("extrait les deux blocs l'un après l'autre", () => {
    const raw =
      'Voici le rapport.\n<!--ARTEFACT: {"kind":"report","title":"Mon rapport","body":"Hello"}-->\n' +
      '<!--THEME_TAB: {"action":"create","label":"Dossier","moduleIds":["tab-1"]}-->';
    const afterA = extractArtefactSignal(raw);
    expect(afterA.artefact?.title).toBe("Mon rapport");
    const afterT = extractThemeTabSignal(afterA.text);
    expect(afterT.themeAction).toEqual({
      action: "create",
      label: "Dossier",
      moduleIds: ["tab-1"],
    });
  });
});
