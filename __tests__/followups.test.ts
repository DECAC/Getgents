import { extractFollowups, FOLLOWUPS_PROMPT_INSTRUCTION } from "@/lib/suggestions";
import { buildGentSystemPrompt } from "@/lib/gentRuntimePrompt";
import type { Espace } from "@/lib/types";

describe("extractFollowups", () => {
  it("extrait jusqu'à 3 relances et les retire du texte", () => {
    const raw =
      'Voici mon analyse.\n<!--FOLLOWUPS: ["Et pour le budget ?","Quels délais ?","Qui contacter ?"]-->';
    const { text, followups } = extractFollowups(raw);
    expect(text).toBe("Voici mon analyse.");
    expect(followups).toEqual(["Et pour le budget ?", "Quels délais ?", "Qui contacter ?"]);
  });

  it("ignore un bloc malformé", () => {
    const { text, followups } = extractFollowups("Texte <!--FOLLOWUPS: pas-json-->");
    expect(followups).toEqual([]);
    expect(text).toContain("Texte");
  });

  it("masque un bloc tronqué", () => {
    const { text, followups } = extractFollowups('Intro <!--FOLLOWUPS: ["Question');
    expect(followups).toEqual([]);
    expect(text).toBe("Intro");
  });
});

describe("consigne runtime", () => {
  it("rappelle de ne pas proposer à chaque message", () => {
    expect(FOLLOWUPS_PROMPT_INSTRUCTION).toMatch(/PAS à chaque|régulièrement/i);
  });

  it("est injectée dans le prompt système du gent", () => {
    const espace = {
      icon: "✨",
      name: "Test",
      gent: "Test",
      version: 1,
      status: "live",
      statusLabel: "Actif",
      sensitive: false,
      metrics: [],
      integrations: [],
      tools: [],
      tabs: [],
      map: null,
      memory: "",
      conversations: [],
      activeConversationId: "c1",
      files: [],
      artefacts: [],
      systemPrompt: "Tu es un gent.",
    } as Espace;
    expect(buildGentSystemPrompt(espace, { variant: "espace" })).toContain("<!--FOLLOWUPS:");
    expect(buildGentSystemPrompt(espace, { variant: "sharedLink" })).toContain("<!--FOLLOWUPS:");
  });
});
