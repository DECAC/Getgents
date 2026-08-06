import { draftContentSnapshot, isDirtySincePublish } from "@/lib/builderSnapshot";
import type { GentDraft } from "@/lib/types/builder";

function draft(patch: Partial<GentDraft> = {}): GentDraft {
  const base: GentDraft = {
    id: "g1",
    name: "NextMove",
    icon: "🧭",
    objective: "Observer les carrières",
    systemPrompt: "Tu es NextMove.",
    status: "published",
    updatedAt: "à l'instant",
    modelAssignments: [
      { capability: "chat", modelId: "anthropic/claude-sonnet-5" },
      { capability: "reasoning", modelId: null },
      { capability: "image", modelId: null },
      { capability: "tts", modelId: null },
      { capability: "stt", modelId: null },
    ],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    webSearch: true,
  };
  const next = { ...base, ...patch };
  return { ...next, publishedSnapshot: patch.publishedSnapshot ?? draftContentSnapshot(next) };
}

describe("empreinte de publication", () => {
  it("détecte un changement de modèle", () => {
    const published = draft();
    const edited = {
      ...published,
      modelAssignments: published.modelAssignments.map((a) =>
        a.capability === "chat" ? { ...a, modelId: "mistralai/mistral-large" } : a
      ),
    };
    expect(isDirtySincePublish(edited)).toBe(true);
  });

  it("détecte un changement d'artefact figé (mini-app)", () => {
    const published = draft({
      pinnedArtefact: { enabled: true, title: "Arbre", mission: "Mission A", inputs: [] },
    });
    const edited = {
      ...published,
      pinnedArtefact: { enabled: true, title: "Arbre", mission: "Mission B", inputs: [] },
    };
    expect(isDirtySincePublish(edited)).toBe(true);
  });

  it("détecte l'ajout d'une entrée LinkedIn sans tenir compte des valeurs", () => {
    const published = draft({
      pinnedArtefact: {
        enabled: true,
        title: "Arbre",
        mission: "M",
        inputs: [{ id: "cv", label: "CV", kind: "file" as const }],
      },
    });
    const edited: GentDraft = {
      ...published,
      pinnedArtefact: {
        enabled: true,
        title: "Arbre",
        mission: "M",
        inputs: [
          { id: "cv", label: "CV", kind: "file", value: "contenu perso" },
          { id: "li", label: "Connexions LinkedIn", kind: "file" },
        ],
        dashboard: { blocks: [] } as never,
        generatedAt: "2026-08-01T00:00:00Z",
      },
    };
    expect(isDirtySincePublish(edited)).toBe(true);
  });

  it("ignore le rendu généré (dashboard) pour le dirty check", () => {
    const published = draft({
      pinnedArtefact: { enabled: true, title: "Arbre", mission: "M", inputs: [] },
    });
    const withDashboard = {
      ...published,
      pinnedArtefact: {
        ...published.pinnedArtefact!,
        dashboard: { blocks: [{ type: "text", body: "x" }] } as never,
        generatedAt: "2026-08-01T00:00:00Z",
      },
    };
    // republie l'empreinte sans dashboard
    withDashboard.publishedSnapshot = draftContentSnapshot({
      ...withDashboard,
      pinnedArtefact: { enabled: true, title: "Arbre", mission: "M", inputs: [] },
    });
    expect(isDirtySincePublish(withDashboard)).toBe(false);
  });

  it("détecte un changement de routine", () => {
    const published = draft({
      routine: { enabled: true, frequency: "daily" as const, hour: 8, mission: "Veille" },
    });
    const edited: GentDraft = {
      ...published,
      routine: { enabled: true, frequency: "daily", hour: 9, mission: "Veille" },
    };
    expect(isDirtySincePublish(edited)).toBe(true);
  });

  it("reste propre si rien n'a changé", () => {
    expect(isDirtySincePublish(draft())).toBe(false);
  });
});
