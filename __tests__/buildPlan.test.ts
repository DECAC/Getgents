import {
  buildPlanNote,
  buildPlanProgress,
  computeBuildPlan,
  nextBuildGap,
  BUILD_STEP_TAB,
} from "@/lib/buildPlan";
import type { GentDraft } from "@/lib/types/builder";

function draft(partial: Partial<GentDraft> = {}): GentDraft {
  return {
    id: "g1",
    name: "Nouveau gent",
    icon: "✨",
    objective: "",
    systemPrompt: "",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    ...partial,
  } as GentDraft;
}

const complet = draft({
  name: "Radar Emploi",
  objective: "surveiller les offres",
  systemPrompt: "Tu surveilles le marché.",
  status: "published",
});

describe("plan de construction", () => {
  it("part de sept étapes, toutes à faire sur un brouillon vierge", () => {
    const plan = computeBuildPlan(draft());
    expect(plan).toHaveLength(7);
    expect(plan.every((s) => !s.done)).toBe(true);
  });

  it("ne compte pas le nom du gabarit comme un nom choisi", () => {
    // « Nouveau gent » est le nom par défaut : il ne vaut pas configuration.
    expect(computeBuildPlan(draft()).find((s) => s.id === "name")?.done).toBe(false);
    expect(computeBuildPlan(draft({ name: "Radar" })).find((s) => s.id === "name")?.done).toBe(true);
  });

  it("distingue l'indispensable du facultatif", () => {
    const plan = computeBuildPlan(draft());
    const optional = plan.filter((s) => s.optional).map((s) => s.id);
    expect(optional).toEqual(["knowledge", "connectors", "apercu"]);
  });

  it("associe chaque étape à un onglet du studio", () => {
    for (const step of computeBuildPlan(draft())) {
      expect(BUILD_STEP_TAB[step.id]).toBeTruthy();
    }
  });
});

describe("prochaine étape", () => {
  it("pointe le premier manque obligatoire", () => {
    expect(nextBuildGap(draft())?.id).toBe("name");
    expect(nextBuildGap(draft({ name: "Radar" }))?.id).toBe("objective");
  });

  it("ignore les étapes facultatives, qui ne bloquent jamais la diffusion", () => {
    // Tout l'obligatoire est fait, mais ni connaissances ni connecteurs.
    const presqueFini = draft({ name: "Radar", objective: "o", systemPrompt: "p" });
    expect(nextBuildGap(presqueFini)?.id).toBe("diffusion");
  });

  it("ne renvoie plus rien quand le gent est complet", () => {
    expect(nextBuildGap(complet)).toBeNull();
  });
});

describe("avancement affiché", () => {
  it("ne compte que les étapes obligatoires", () => {
    expect(buildPlanProgress(draft())).toEqual({ done: 0, total: 4 });
    expect(buildPlanProgress(complet)).toEqual({ done: 4, total: 4 });
  });
});

describe("note injectée dans le prompt", () => {
  it("reste courte — elle est payée à chaque tour", () => {
    expect(buildPlanNote(draft()).length).toBeLessThanOrEqual(300);
  });

  it("nomme ce qui manque et la prochaine étape", () => {
    const note = buildPlanNote(draft({ name: "Radar" }));
    expect(note).toContain("Définir l'objectif");
    expect(note).toMatch(/Prochaine étape indispensable/);
  });

  it("ne présente jamais le facultatif comme un manque bloquant", () => {
    // Tout l'obligatoire est fait : le gent est diffusable, même sans
    // connaissances ni connecteurs. Confondre les deux ferait courir le
    // créateur après des étapes qui ne le bloquent pas.
    const note = buildPlanNote(complet);
    expect(note).toContain("diffusable");
    expect(note).toContain("facultatives");
    expect(note).not.toMatch(/reste à faire/);
  });

  it("annonce un gent entièrement complet", () => {
    const total = { ...complet, knowledgeSources: [{ id: "k", kind: "file", label: "l", meta: "m" }],
      connectors: [{ id: "c", toolKind: "mcp", name: "n" }],
      appPreview: { themes: ["A"], modules: [{ id: "m", title: "T", theme: "A", size: "large", blocks: [] }] } } as unknown as GentDraft;
    expect(buildPlanNote(total)).toContain("complet : toutes les étapes");
  });
});
