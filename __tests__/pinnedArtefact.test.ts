import { extractPinnedDashboard } from "@/lib/server/pinnedArtefact";
import { extractLlmMessageText } from "@/lib/server/llmMessageText";
import { extractJsonFromHtmlMarker } from "@/lib/server/markerJson";

describe("extractJsonFromHtmlMarker", () => {
  it("extrait un JSON imbriqué après PINNED", () => {
    const payload = { dashboard: { blocks: [{ type: "stats", items: [{ label: "Prix", value: "100 €" }] }] } };
    const raw = `<!--PINNED: ${JSON.stringify(payload)}-->`;
    expect(extractJsonFromHtmlMarker(raw, "PINNED")).toBe(JSON.stringify(payload));
  });
});

describe("extractLlmMessageText", () => {
  it("concatène content et reasoning si content vide", () => {
    const text = extractLlmMessageText({
      choices: [{ message: { content: "", reasoning: '<!--PINNED: {"dashboard":{"blocks":[]}}-->' } }],
    });
    expect(text).toContain("PINNED");
  });
});

describe("extractPinnedDashboard", () => {
  it("parse un bloc PINNED imbriqué", () => {
    const raw =
      '<!--PINNED: {"dashboard":{"blocks":[{"type":"stats","items":[{"label":"Prix","value":"685 000 €"}]},{"type":"text","body":"Synthèse"}]}}-->';
    const spec = extractPinnedDashboard(raw);
    expect(spec?.blocks).toHaveLength(2);
  });

  it("parse un bloc ARTEFACT kind dashboard", () => {
    const raw =
      '<!--ARTEFACT: {"kind":"dashboard","title":"T","dashboard":{"blocks":[{"type":"heading","text":"Titre"},{"type":"text","body":"Corps"}]}}-->';
    expect(extractPinnedDashboard(raw)?.blocks).toHaveLength(2);
  });

  it("rejette des blocs invalides (stats sans value)", () => {
    const raw = '<!--PINNED: {"dashboard":{"blocks":[{"type":"stats","items":[{"label":"A"}]}]}}-->';
    expect(extractPinnedDashboard(raw)).toBeNull();
  });
});
