import { ASSISTANTS, GUIDES, assistantDuGuide } from "@/lib/guidesAssistants";

describe("guides par assistant", () => {
  it("lit le paramètre ?guide=, l'ancien « 1 » menant à Claude", () => {
    expect(assistantDuGuide("chatgpt")).toBe("chatgpt");
    expect(assistantDuGuide("perplexity")).toBe("perplexity");
    expect(assistantDuGuide("1")).toBe("claude");
    expect(assistantDuGuide("inconnu")).toBe("claude");
    expect(assistantDuGuide(null)).toBe("claude");
  });

  it("ne présente comme essayé QUE le connecteur réellement essayé (Claude)", () => {
    expect(ASSISTANTS.filter((a) => GUIDES[a].connecteurEssaye)).toEqual(["claude"]);
  });

  it("chaque guide a son copier-coller, qui demande une page autonome", () => {
    for (const a of ASSISTANTS) {
      expect(GUIDES[a].coller.length).toBeGreaterThanOrEqual(3);
      expect(GUIDES[a].coller.join(" ")).toMatch(/données écrites dans la page/);
      expect(GUIDES[a].coller.join(" ")).toMatch(/Nouvelle page/);
    }
  });
});
