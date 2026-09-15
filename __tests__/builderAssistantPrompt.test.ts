import {
  BUILDER_ROLE_CLOSING,
  BUILDER_ROLE_INSTRUCTION,
  buildBuilderSystemPrompt,
  frameBuilderKnowledgeFileMessage,
  frameBuilderObjectiveMessage,
  isBuilderObjectiveSeedTurn,
} from "@/lib/builderAssistantPrompt";
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
    builderConversation: [
      {
        role: "agent",
        text: "<p>Bienvenue ! Décrivez en une phrase l'objectif…</p>",
        t: "à l'instant",
      },
    ],
    ...partial,
  };
}

describe("buildBuilderSystemPrompt", () => {
  it("affirme le rôle configurateur en tête et en queue", () => {
    const prompt = buildBuilderSystemPrompt(draft({ objective: "analyse DPE de maisons à vendre." }));
    expect(prompt.startsWith(BUILDER_ROLE_INSTRUCTION)).toBe(true);
    expect(prompt.endsWith(BUILDER_ROLE_CLOSING)).toBe(true);
  });

  it("interdit de répondre comme l'expert métier / le gent fini", () => {
    const prompt = buildBuilderSystemPrompt(draft());
    expect(prompt).toMatch(/n'ES PAS le gent publié/i);
    expect(prompt).toMatch(/dissertations métier/i);
    expect(prompt).toMatch(/GENT_CONFIG/);
  });

  it("rappelle l'objectif et le prompt existant du gent", () => {
    const prompt = buildBuilderSystemPrompt(
      draft({
        name: "DPE Scout",
        objective: "analyser les DPE",
        systemPrompt: "Tu es un analyste DPE.",
      })
    );
    expect(prompt).toContain("DPE Scout");
    expect(prompt).toContain("analyser les DPE");
    expect(prompt).toContain("Tu es un analyste DPE.");
  });

  it("signale les fichiers de connaissance sans en recopier le contenu", () => {
    const prompt = buildBuilderSystemPrompt(
      draft({
        knowledgeSources: [
          {
            id: "k1",
            kind: "file",
            label: "livre-blanc.pdf",
            meta: "12 000 caractères",
            text: "Chapitre secret que l'assistant du builder ne doit pas recracher.",
          },
        ],
      })
    );
    expect(prompt).toContain("livre-blanc.pdf");
    expect(prompt).toContain("contenu lu, disponible pour le gent publié");
    expect(prompt).toMatch(/ne les recopie pas/i);
    expect(prompt).not.toContain("Chapitre secret");
  });

  it("liste les connecteurs déjà configurés", () => {
    const prompt = buildBuilderSystemPrompt(
      draft({
        connectors: [{ id: "c1", toolKind: "dataset", name: "DVF", detail: "https://example.com/dvf" }],
      })
    );
    expect(prompt).toContain("Connecteurs déjà configurés");
    expect(prompt).toContain("DVF");
  });
});

describe("isBuilderObjectiveSeedTurn", () => {
  it("est vrai juste après le message de bienvenue, prompt vide", () => {
    expect(isBuilderObjectiveSeedTurn(draft())).toBe(true);
  });

  it("reste vrai même si l'objectif a déjà été posé sur l'accueil studio", () => {
    expect(isBuilderObjectiveSeedTurn(draft({ objective: "analyse DPE de maisons à vendre." }))).toBe(true);
  });

  it("est faux dès qu'un prompt système existe", () => {
    expect(isBuilderObjectiveSeedTurn(draft({ systemPrompt: "Tu es…" }))).toBe(false);
  });

  it("est faux après un premier message utilisateur", () => {
    expect(
      isBuilderObjectiveSeedTurn(
        draft({
          builderConversation: [
            { role: "agent", text: "Bienvenue", t: "…" },
            { role: "user", text: "analyse DPE", t: "…" },
          ],
        })
      )
    ).toBe(false);
  });
});

describe("frameBuilderKnowledgeFileMessage", () => {
  it("annonce le fichier sans inclure son contenu", () => {
    const msg = frameBuilderKnowledgeFileMessage("CV.pdf", 12340, false);
    expect(msg).toContain("CV.pdf");
    expect(msg).toContain("12");
    expect(msg).toMatch(/connaissances du gent/i);
    expect(msg).toMatch(/ne le recopie pas/i);
    expect(msg).not.toContain("expérience professionnelle");
  });

  it("garde le commentaire du créateur, toujours sans le document", () => {
    const msg = frameBuilderKnowledgeFileMessage("offre.pdf", 200, true, "sers-t'en pour le prompt");
    expect(msg).toContain("extrait tronqué");
    expect(msg).toContain("sers-t'en pour le prompt");
  });
});

describe("frameBuilderObjectiveMessage", () => {
  it("cadre l'objectif comme mission à configurer, pas comme question métier", () => {
    const framed = frameBuilderObjectiveMessage("analyse DPE de maisons à vendre.");
    expect(framed).toContain("analyse DPE de maisons à vendre.");
    expect(framed).toMatch(/Objectif du gent à construire/i);
    expect(framed).toMatch(/GENT_CONFIG/);
    expect(framed).toMatch(/Ne réponds pas comme l'expert métier/i);
  });
});

describe("profils de tour (prompt système à la carte)", () => {
  const d = draft({ objective: "veille immobilière", systemPrompt: "Tu es un expert." });

  it("le profil par défaut reste l'assemblage historique complet", () => {
    // Non-régression : les six aller-retours de signaux existants dépendent de
    // cet assemblage. Un bloc qui disparaîtrait ici casserait silencieusement
    // la production d'artefacts, de connecteurs ou de formulaires jump.
    const prompt = buildBuilderSystemPrompt(d);
    for (const marker of ["GENT_CONFIG", "APERCU", "CONNECTOR", "JUMP_FORM", "QUESTIONS"]) {
      expect(prompt).toContain(marker);
    }
    expect(buildBuilderSystemPrompt(d, "conversation")).toBe(prompt);
  });

  it("garde le verrou de rôle en tête et en queue sur TOUS les profils", () => {
    for (const p of ["conversation", "cadrage", "prompt", "jump-form", "connectors"] as const) {
      const prompt = buildBuilderSystemPrompt(d, p);
      expect(prompt.startsWith(BUILDER_ROLE_INSTRUCTION)).toBe(true);
      expect(prompt.endsWith(BUILDER_ROLE_CLOSING)).toBe(true);
    }
  });

  it("le profil cadrage n'embarque pas les instructions d'aperçu", () => {
    const cadrage = buildBuilderSystemPrompt(d, "cadrage");
    // Le format des modules d'aperçu pèse ~10 500 caractères : hors sujet pour
    // un tour qui ne fait que poser une question.
    expect(cadrage).not.toContain("<!--APERCU:");
    expect(cadrage).not.toContain("<!--JUMP_FORM:");
    // …mais il lui faut le format des questions cliquables.
    expect(cadrage).toContain("QUESTIONS");
  });

  it("allège réellement : le cadrage pèse une fraction de la conversation", () => {
    const full = buildBuilderSystemPrompt(d, "conversation").length;
    const cadrage = buildBuilderSystemPrompt(d, "cadrage").length;
    expect(cadrage).toBeLessThan(full / 2);
  });

  it("chaque profil spécialisé porte son propre format et pas ceux des autres", () => {
    expect(buildBuilderSystemPrompt(d, "jump-form")).toContain("JUMP_FORM");
    expect(buildBuilderSystemPrompt(d, "jump-form")).not.toContain("<!--APERCU:");
    expect(buildBuilderSystemPrompt(d, "connectors")).toContain("CONNECTOR");
    expect(buildBuilderSystemPrompt(d, "connectors")).not.toContain("<!--JUMP_FORM:");
    expect(buildBuilderSystemPrompt(d, "prompt")).toContain("GENT_CONFIG");
  });
});
