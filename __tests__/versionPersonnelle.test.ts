import { composerVersionPersonnelle, fusionnerUsage } from "@/lib/versionPersonnelle";
import type { Espace } from "@/lib/types";

function espace(partial: Partial<Espace>): Espace {
  return {
    icon: "📬", name: "Assistant Email", gent: "Assistant Email", version: 1,
    status: "live", statusLabel: "Actif", sensitive: false,
    metrics: [], integrations: [], tools: [], tabs: [], map: null,
    memory: "", conversations: [{ id: "c0", startedAt: "", messages: [] }], activeConversationId: "c0",
    files: [], artefacts: [],
    ...partial,
  } as Espace;
}

const diffusee = espace({
  version: 10,
  systemPrompt: "PROMPT DIFFUSÉ",
  chatModelId: "google/gemini-2.5-flash",
  memory: "mémoire figée à la diffusion",
  conversations: [{ id: "vieux", startedAt: "", messages: [{ role: "user", text: "ancien" }] }],
  activeConversationId: "vieux",
});

const travail = espace({
  version: 12,
  systemPrompt: "PROMPT EN COURS DE MODIFICATION",
  chatModelId: "anthropic/claude-sonnet-5",
  memory: "ma mémoire du jour",
  conversations: [{ id: "c1", startedAt: "", messages: [{ role: "user", text: "bilan de ce matin" }] }],
  activeConversationId: "c1",
  artefacts: [{ id: "note-1", title: "Veille IA", type: "Note", icon: "📝", date: "hier" }],
  themeTabs: [{ id: "t1", label: "Veille", moduleIds: ["note-1"] }],
});

describe("espace personnel : configuration diffusée, usage du jour", () => {
  it("la configuration vient de la version diffusée", () => {
    const e = composerVersionPersonnelle(diffusee, travail);
    expect(e.systemPrompt).toBe("PROMPT DIFFUSÉ");
    expect(e.chatModelId).toBe("google/gemini-2.5-flash");
    expect(e.version).toBe(10);
  });

  it("les conversations, notes, onglets et la mémoire viennent de l'usage", () => {
    const e = composerVersionPersonnelle(diffusee, travail);
    expect(e.conversations[0].id).toBe("c1");
    expect(e.activeConversationId).toBe("c1");
    expect(e.memory).toBe("ma mémoire du jour");
    expect(e.artefacts.map((a) => a.id)).toEqual(["note-1"]);
    expect(e.themeTabs).toEqual(travail.themeTabs);
  });

  it("un gent jamais diffusé tourne sur sa version de travail", () => {
    expect(composerVersionPersonnelle(null, travail)).toBe(travail);
  });

  it("le document d'une visionneuse est celui de la version diffusée", () => {
    const docDiffuse = { id: "visionneuse-doc", title: "Livre blanc v2", type: "Visionneuse", icon: "📖", date: "" };
    const docTravail = { id: "visionneuse-doc", title: "Livre blanc v3 (brouillon)", type: "Visionneuse", icon: "📖", date: "" };
    const e = composerVersionPersonnelle(
      { ...diffusee, artefacts: [docDiffuse] },
      { ...travail, artefacts: [docTravail, ...travail.artefacts] }
    );
    expect(e.artefacts.map((a) => a.title)).toEqual(["Livre blanc v2", "Veille IA"]);
  });

  it("mini-app : la mission diffusée, mais les valeurs saisies et le tableau de bord du jour", () => {
    const e = composerVersionPersonnelle(
      { ...diffusee, pinnedArtefact: { enabled: true, title: "Bilan", mission: "MISSION DIFFUSÉE", inputs: [{ id: "p", label: "Période", kind: "text" }] } },
      { ...travail, pinnedArtefact: { enabled: true, title: "Bilan", mission: "MISSION EN COURS", inputs: [{ id: "p", label: "Période", kind: "text", value: "7 jours" }], dashboard: { blocks: [] } as never, generatedAt: "ce matin" } }
    );
    expect(e.pinnedArtefact?.mission).toBe("MISSION DIFFUSÉE");
    expect(e.pinnedArtefact?.inputs[0].value).toBe("7 jours");
    expect(e.pinnedArtefact?.generatedAt).toBe("ce matin");
  });
});

describe("écriture depuis l'espace personnel", () => {
  it("n'écrase JAMAIS la configuration en cours du studio", () => {
    const vu = composerVersionPersonnelle(diffusee, travail);
    const apresUsage = { ...vu, conversations: [{ id: "c1", startedAt: "", messages: [{ role: "user" as const, text: "nouvelle question" }] }] };
    const ecrit = fusionnerUsage(travail, apresUsage);
    expect(ecrit.systemPrompt).toBe("PROMPT EN COURS DE MODIFICATION");
    expect(ecrit.chatModelId).toBe("anthropic/claude-sonnet-5");
    expect(ecrit.version).toBe(12);
  });

  it("reporte l'usage : nouvelle conversation, note gardée", () => {
    const vu = composerVersionPersonnelle(diffusee, travail);
    const note = { id: "note-2", title: "Nouvelle", type: "Note", icon: "📝", date: "à l'instant" };
    const ecrit = fusionnerUsage(travail, { ...vu, artefacts: [note, ...vu.artefacts] });
    expect(ecrit.artefacts.map((a) => a.id)).toEqual(["note-2", "note-1"]);
  });

  it("le document de visionneuse du studio survit à l'écriture de l'espace", () => {
    const docTravail = { id: "visionneuse-doc", title: "Livre blanc v3", type: "Visionneuse", icon: "📖", date: "" };
    const docDiffuse = { ...docTravail, title: "Livre blanc v2" };
    const t = { ...travail, artefacts: [docTravail] };
    const vu = composerVersionPersonnelle({ ...diffusee, artefacts: [docDiffuse] }, t);
    expect(fusionnerUsage(t, vu).artefacts.find((a) => a.id === "visionneuse-doc")?.title).toBe("Livre blanc v3");
  });

  it("lire puis écrire sans rien faire rend la version de travail à l'identique", () => {
    const aller = fusionnerUsage(travail, composerVersionPersonnelle(diffusee, travail));
    expect(aller).toEqual({ ...travail, routine: undefined, channel: undefined, pinnedArtefact: undefined });
  });
});
