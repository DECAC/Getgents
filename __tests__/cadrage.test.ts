import {
  CADRAGE_ACTIONS,
  buildCadrageAskMessage,
  buildCadrageFollowUpMessage,
  buildCadrageSystemPrompt,
  shouldSkipCadrage,
  type CadrageAction,
} from "@/lib/cadrage";
import { QUICK_REPLY_TRUST_LABEL } from "@/lib/suggestions";
import type { GentDraft } from "@/lib/types/builder";

function draft(partial: Partial<GentDraft> = {}): GentDraft {
  return {
    id: "g1",
    name: "Radar Emploi",
    icon: "✨",
    objective: "surveiller les offres d'emploi",
    systemPrompt: "Tu surveilles le marché.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    ...partial,
  } as GentDraft;
}

const ALL: CadrageAction[] = ["apercu", "apercu-evolve", "prompt", "jump-form", "connectors"];

describe("prompt système du tour de cadrage", () => {
  it("interdit tous les marqueurs de génération", () => {
    // Sans ce verrou, le modèle pose la question ET génère dans la foulée :
    // le créateur verrait une carte « Appliquer » avant d'avoir choisi.
    for (const action of ALL) {
      const prompt = buildCadrageSystemPrompt(draft(), action);
      expect(prompt).toMatch(/N'émets AUCUN bloc APERCU, GENT_CONFIG, CONNECTOR/);
      expect(prompt).toContain("TOUR DE CADRAGE");
    }
  });

  it("n'embarque pas le format de l'aperçu, même pour cadrer un aperçu", () => {
    const prompt = buildCadrageSystemPrompt(draft(), "apercu");
    expect(prompt).not.toContain("<!--APERCU:");
    expect(prompt).not.toContain("<!--JUMP_FORM:");
  });

  it("réclame les deux pseudo-options à l'interface, pas au modèle", () => {
    const prompt = buildCadrageSystemPrompt(draft(), "apercu");
    expect(prompt).toMatch(/n'inclus ni « Autre » ni « Fais-moi confiance »/i);
  });

  it("impose son sujet à chaque action", () => {
    expect(buildCadrageSystemPrompt(draft(), "apercu")).toMatch(/ONGLETS/);
    expect(buildCadrageSystemPrompt(draft(), "connectors")).toMatch(/SOURCES DE DONNÉES/);
    expect(buildCadrageSystemPrompt(draft(), "jump-form")).toMatch(/INFORMATIONS/);
  });
});

describe("registre des actions", () => {
  it("couvre les cinq moments structurants, chacun sur le profil allégé", () => {
    expect(Object.keys(CADRAGE_ACTIONS).sort()).toEqual([...ALL].sort());
    for (const action of ALL) {
      expect(CADRAGE_ACTIONS[action].profile).toBe("cadrage");
      expect(buildCadrageAskMessage(action).length).toBeGreaterThan(20);
    }
  });
});

describe("reprise de la génération après réponse", () => {
  const pending = { action: "apercu" as const, request: "Génère l'aperçu de l'application." };

  it("conserve la requête d'origine et y joint les préférences", () => {
    const msg = buildCadrageFollowUpMessage(pending, "1. Quels onglets ? → Suivi, Analyse");
    expect(msg).toContain("Génère l'aperçu de l'application.");
    expect(msg).toContain("Suivi, Analyse");
    expect(msg).toContain("Préférences du créateur");
    expect(msg).toContain(CADRAGE_ACTIONS.apercu.applyInstruction);
  });

  it("laisse l'assistant trancher sur « Fais-moi confiance »", () => {
    const msg = buildCadrageFollowUpMessage(pending, `1. Quels onglets ? → ${QUICK_REPLY_TRUST_LABEL}`);
    expect(msg).toContain("Génère l'aperçu de l'application.");
    expect(msg).toContain("te laisse trancher");
    // Aucune préférence ne doit être imposée dans ce cas.
    expect(msg).not.toContain("Préférences du créateur");
  });

  it("traite une réponse vide comme un blanc-seing plutôt que d'imposer du vide", () => {
    const msg = buildCadrageFollowUpMessage(pending, "   ");
    expect(msg).toContain("te laisse trancher");
  });
});

describe("court-circuit du cadrage", () => {
  it("saute la question quand le mode persistant est actif", () => {
    expect(shouldSkipCadrage(draft({ autoPilot: true }))).toBe(true);
  });

  it("consulte par défaut", () => {
    expect(shouldSkipCadrage(draft())).toBe(false);
    expect(shouldSkipCadrage(draft({ autoPilot: false }))).toBe(false);
  });
});
