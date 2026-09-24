import { appliquerFormat, brouillonNeuf, ONGLET_DU_FORMAT, FORMATS_GENT, freshDraftFromTemplate } from "@/lib/builderDraftStorage";

describe("création d'un gent : un format, une phrase facultative", () => {
  it("un gent conversationnel n'active aucune autre facette", () => {
    const d = brouillonNeuf("draft-1", "conversationnel");
    expect(d.id).toBe("draft-1");
    expect(d.pinnedArtefact?.enabled ?? false).toBe(false);
    expect(d.visionneuse?.enabled ?? false).toBe(false);
    expect(d.collab?.enabled ?? false).toBe(false);
  });

  it("chaque format ACTIVE sa facette, pour ne pas arriver sur un onglet éteint", () => {
    expect(brouillonNeuf("a", "miniapp").pinnedArtefact?.enabled).toBe(true);
    expect(brouillonNeuf("b", "visionneuse").visionneuse?.enabled).toBe(true);
    expect(brouillonNeuf("c", "collaboratif").collab?.enabled).toBe(true);
  });

  it("activer un format ne touche pas une configuration déjà écrite", () => {
    const base = {
      ...freshDraftFromTemplate("d"),
      pinnedArtefact: { enabled: false, title: "Veille", mission: "Suivre", inputs: [] },
    };
    const d = appliquerFormat(base, "miniapp");
    expect(d.pinnedArtefact).toMatchObject({ enabled: true, title: "Veille", mission: "Suivre" });
  });

  it("la description devient objectif provisoire et message rejoué", () => {
    const d = brouillonNeuf("e", "conversationnel", "  Un gent qui trie mes candidatures  ");
    expect(d.objective).toBe("Un gent qui trie mes candidatures");
    expect(d.pendingBuilderMessage).toBe("Un gent qui trie mes candidatures");
  });

  it("sans description, rien n'est rejoué dans l'assistant", () => {
    const d = brouillonNeuf("f", "miniapp", "   ");
    expect(d.pendingBuilderMessage).toBeUndefined();
  });

  it("l'Event Manager garde son emblème même avec une description", () => {
    expect(brouillonNeuf("g", "collaboratif", "Organiser le séminaire").icon).toBe("🧭");
  });

  it("chaque format atterrit là où il se configure — le conversationnel sur ses instructions", () => {
    expect(ONGLET_DU_FORMAT.conversationnel).toBe("prompt");
    for (const f of FORMATS_GENT) expect(ONGLET_DU_FORMAT[f]).toBeTruthy();
  });
});
