import { espacePourApercu, espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

function espace(partial: Partial<Espace> = {}): Espace {
  return {
    icon: "📬",
    name: "Assistant Email",
    gent: "Assistant Email",
    version: 10,
    status: "live",
    statusLabel: "Actif",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "Mémoire des essais du créateur",
    systemPrompt: "Tu tries la boîte de réception.",
    conversations: [
      { id: "conv-1", startedAt: "hier", messages: [{ role: "user", text: "essai précédent" }] },
    ],
    activeConversationId: "conv-1",
    files: [{ id: "f1", name: "cv.pdf" }],
    artefacts: [
      { id: "a1", title: "Bilan de la semaine", type: "Tableau de bord", icon: "📊", date: "hier", kind: "dashboard" },
    ],
    ...partial,
  } as Espace;
}

describe("aperçu du créateur : ce que verra un visiteur", () => {
  it("repart d'un fil vierge, comme le visiteur", () => {
    const out = espacePourApercu(espace());
    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0].messages).toEqual([]);
    expect(out.activeConversationId).toBe(out.conversations[0].id);
    expect(JSON.stringify(out)).not.toContain("essai précédent");
  });

  it("n'emporte ni les artefacts gardés, ni la mémoire, ni les fichiers, ni le profil des essais", () => {
    const out = espacePourApercu(espace({ profile: { metier: "Consultant" } as unknown as Espace["profile"] }));
    expect(out.artefacts).toEqual([]);
    expect(out.memory).toBe("");
    expect(out.files).toEqual([]);
    expect(out.profile).toBeUndefined();
  });

  it("garde le prompt : sans lui le gent ne répondrait pas — le lien le relit côté serveur", () => {
    expect(espacePourApercu(espace()).systemPrompt).toBe("Tu tries la boîte de réception.");
  });

  it("garde la mission de la mini-app mais pas le tableau de bord du créateur", () => {
    const out = espacePourApercu(
      espace({
        pinnedArtefact: {
          enabled: true,
          title: "Bilan email",
          mission: "Priorise la boîte",
          inputs: [],
          dashboard: { title: "Mon bilan", blocks: [] } as never,
          generatedAt: "hier",
        },
      })
    );
    expect(out.pinnedArtefact?.mission).toBe("Priorise la boîte");
    expect(out.pinnedArtefact?.dashboard).toBeUndefined();
    expect(out.pinnedArtefact?.generatedAt).toBeUndefined();
  });

  it("montre les mêmes champs visibles que la projection publique", () => {
    const e = espace({ starters: ["Q1"], propulsePar: "Charles" });
    const apercu = espacePourApercu(e);
    const visiteur = espaceForPublicLink(e);
    for (const cle of ["name", "gent", "icon", "starters", "propulsePar", "artefacts", "memory", "files"] as const) {
      expect(apercu[cle]).toEqual(visiteur[cle]);
    }
  });

  it("garde le document fixé d'une visionneuse, livrable public du gent", () => {
    const doc = { id: "visionneuse-doc", title: "Livre blanc", type: "Visionneuse", icon: "📖", date: "—" };
    const out = espacePourApercu(
      espace({ visionneuse: { enabled: true, instructions: "" }, artefacts: [doc as Espace["artefacts"][number]] })
    );
    expect(out.artefacts.map((a) => a.id)).toEqual(["visionneuse-doc"]);
  });
});
