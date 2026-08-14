import { espaceForPublicLink, espaceForStarters } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

function espace(partial: Partial<Espace> = {}): Espace {
  return {
    icon: "🏡",
    name: "La Gargoulais",
    gent: "Compagnon Immobilier",
    version: 3,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "Mémoire du créateur",
    conversations: [
      { id: "conv-1", startedAt: "hier", messages: [{ role: "user", text: "secret du créateur" }] },
    ],
    activeConversationId: "conv-1",
    files: [],
    artefacts: [],
    ...partial,
  } as Espace;
}

describe("projection publique d'un lien de partage", () => {
  it("expose un fil actif réellement présent", () => {
    // Régression : la projection annonçait activeConversationId "shared" avec
    // une liste de conversations VIDE. Tous les `map` sur conversations
    // devenaient des no-op — la question du visiteur comme la réponse du gent
    // n'étaient jamais stockées, et le premier échange restait sans réponse.
    const out = espaceForPublicLink(espace());
    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0].id).toBe(out.activeConversationId);
    expect(out.conversations.some((c) => c.id === out.activeConversationId)).toBe(true);
  });

  it("n'expose aucun message du créateur", () => {
    const out = espaceForPublicLink(espace());
    expect(out.conversations[0].messages).toEqual([]);
    expect(JSON.stringify(out)).not.toContain("secret du créateur");
  });

  it("n'expose ni mémoire ni prompt système", () => {
    const out = espaceForPublicLink(espace({ systemPrompt: "instructions confidentielles" }));
    expect(out.memory).toBe("");
    expect(out.systemPrompt).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain("instructions confidentielles");
  });

  it("transmet les déclencheurs, qui décrivent le gent et non son créateur", () => {
    const out = espaceForPublicLink(espace({ starters: ["Question A", "Question B"] }));
    expect(out.starters).toEqual(["Question A", "Question B"]);
  });

  it("reconstruit le PDF à télécharger depuis la visionneuse si la liste est vide", () => {
    const out = espaceForPublicLink(
      espace({
        fileDownloadEnabled: true,
        fileDownloadFormEnabled: true,
        artefacts: [
          {
            id: "visionneuse-doc",
            title: "Livre blanc",
            type: "Visionneuse de document",
            icon: "📖",
            date: "Document du gent",
            document: {
              sourceName: "livre-blanc.pdf",
              sourceKind: "pdf",
              pageCount: 1,
              pages: ["Contenu public"],
              toc: [],
              truncated: false,
            },
          },
        ],
      })
    );
    expect(out.fileDownloadEnabled).toBe(true);
    expect(out.downloadableDocuments?.[0].text).toContain("Contenu public");
  });
});

describe("charge utile pour générer les déclencheurs", () => {
  it("transmet les onglets de l'aperçu, pas les données simulées des blocs", () => {
    const out = espaceForStarters(
      espace({
        appPreview: {
          appName: "Radar",
          themes: ["Mon profil"],
          modules: [
            {
              id: "cv",
              title: "Mini CV",
              theme: "Mon profil",
              size: "large",
              blocks: [{ kind: "text", text: "Camille Léaud — données simulées" }],
            },
          ],
        },
      })
    );
    expect(out.appPreview?.themes).toEqual(["Mon profil"]);
    expect(out.appPreview?.modules[0].title).toBe("Mini CV");
    expect(JSON.stringify(out)).not.toContain("Camille Léaud");
  });
});
