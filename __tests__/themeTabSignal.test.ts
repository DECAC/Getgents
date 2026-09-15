import { extractArtefactSignal } from "@/lib/artefactSignal";
import {
  artefactModuleId,
  extractThemeTabSignal,
  themeActionWithArtefact,
  upsertArtefactThemeTab,
} from "@/lib/themeTabSignal";
import type { Artefact, ThemeTab } from "@/lib/types";

function artef(id: string, type: string): Artefact {
  return { id, title: "Titre", type, icon: "📄", date: "à l'instant" };
}

describe("artefactModuleId", () => {
  it("suit le format ModuleCanvas artef-<id>", () => {
    expect(artefactModuleId("artef-123")).toBe("artef-artef-123");
    expect(artefactModuleId("a1")).toBe("artef-a1");
  });
});

describe("upsertArtefactThemeTab", () => {
  it("crée un onglet au nom du type d'artefact", () => {
    const next = upsertArtefactThemeTab([], artef("a1", "Rapport"));
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe("Rapport");
    expect(next[0].moduleIds).toEqual(["artef-a1"]);
  });

  it("réutilise un onglet existant (insensible à la casse)", () => {
    const existing: ThemeTab[] = [{ id: "theme-1", label: "rapport", moduleIds: ["tab-x"] }];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Rapport"));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("theme-1");
    expect(next[0].moduleIds).toEqual(["tab-x", "artef-a1"]);
  });

  it("n'ajoute pas deux fois le même module", () => {
    const existing: ThemeTab[] = [{ id: "theme-1", label: "Rapport", moduleIds: ["artef-a1"] }];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Rapport"));
    expect(next[0].moduleIds).toEqual(["artef-a1"]);
  });

  it("retire le module d'un autre onglet avant de le ranger", () => {
    const existing: ThemeTab[] = [
      { id: "theme-old", label: "Autre", moduleIds: ["artef-a1"] },
      { id: "theme-1", label: "Checklist", moduleIds: ["tab-x"] },
    ];
    const next = upsertArtefactThemeTab(existing, artef("a1", "Checklist"));
    expect(next.find((t) => t.id === "theme-old")).toBeUndefined();
    expect(next.find((t) => t.id === "theme-1")?.moduleIds).toEqual(["tab-x", "artef-a1"]);
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
