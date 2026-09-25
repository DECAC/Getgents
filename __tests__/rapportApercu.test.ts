import { buildEspaceReport } from "@/lib/testReport";
import type { Espace } from "@/lib/types";

const espace = {
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
  memory: "",
  systemPrompt: "Tu tries la boîte.",
  gmail: true,
  conversations: [{ id: "c", startedAt: "25 sept.", messages: [{ role: "user", text: "Trie ma boîte", t: "07:26" }] }],
  activeConversationId: "c",
  files: [],
  artefacts: [],
} as unknown as Espace;

describe("rapport de test", () => {
  it("tiré de l'aperçu, il se dit version de travail — jamais « publiée »", () => {
    const md = buildEspaceReport(espace, undefined, { version: "travail" });
    expect(md).toContain("version de travail");
    expect(md).not.toContain("publiée");
    expect(md).not.toContain("publié");
    expect(md).toContain("Trie ma boîte");
  });

  it("depuis l'espace, il garde ses titres d'origine", () => {
    const md = buildEspaceReport(espace);
    expect(md).toContain("## Configuration publiée");
  });

  it("mentionne le connecteur Gmail, cause fréquente d'un test raté", () => {
    expect(buildEspaceReport(espace)).toContain("**Connecteur Gmail** : actif");
  });
});
