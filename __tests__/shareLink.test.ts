import { canChat, canOpen, canRefresh, describeShareLink, shareLinkState, shareLinkUrl, type ShareLink } from "@/lib/shareLink";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import type { Espace } from "@/lib/types";

const NOW = new Date("2026-08-01T12:00:00Z");

function link(patch: Partial<ShareLink> = {}): ShareLink {
  return {
    token: "a".repeat(32),
    gentId: "radar-emploi",
    targetLabel: "Marie Dupont — Doctolib",
    createdAt: "2026-07-01T09:00:00Z",
    expiresAt: null,
    revokedAt: null,
    allowChat: true,
    allowRefresh: true,
    refreshCount: 0,
    maxRefresh: 20,
    ...patch,
  };
}

describe("validité d'un lien de partage", () => {
  it("accepte un lien actif", () => {
    expect(shareLinkState(link(), NOW)).toBe("active");
    expect(canOpen(link(), NOW)).toBe(true);
    expect(canRefresh(link(), NOW)).toBe(true);
  });

  it("refuse un lien révoqué", () => {
    const l = link({ revokedAt: "2026-07-20T10:00:00Z" });
    expect(shareLinkState(l, NOW)).toBe("revoked");
    expect(canOpen(l, NOW)).toBe(false);
    expect(canChat(l, NOW)).toBe(false);
    expect(canRefresh(l, NOW)).toBe(false);
  });

  it("refuse un lien expiré", () => {
    const l = link({ expiresAt: "2026-07-31T23:59:00Z" });
    expect(shareLinkState(l, NOW)).toBe("expired");
    expect(canOpen(l, NOW)).toBe(false);
  });

  it("laisse consulter un lien dont le quota est atteint, mais bloque la régénération", () => {
    const l = link({ refreshCount: 20, maxRefresh: 20 });
    expect(shareLinkState(l, NOW)).toBe("exhausted");
    expect(canOpen(l, NOW)).toBe(true);
    expect(canChat(l, NOW)).toBe(true);
    expect(canRefresh(l, NOW)).toBe(false);
  });

  it("respecte les autorisations par lien", () => {
    expect(canChat(link({ allowChat: false }), NOW)).toBe(false);
    expect(canRefresh(link({ allowRefresh: false }), NOW)).toBe(false);
  });

  it("construit l'URL sans double barre oblique", () => {
    expect(shareLinkUrl("https://app.exemple.fr/", "tok")).toBe("https://app.exemple.fr/l/tok");
  });

  it("décrit un lien jamais ouvert puis utilisé", () => {
    expect(describeShareLink(link())).toContain("jamais ouvert");
    const used = describeShareLink(link(), { openCount: 3, chatCount: 2, refreshCount: 1, firstOpenAt: NOW.toISOString() });
    expect(used).toContain("ouvert 3 fois");
    expect(used).toContain("1 régénération");
    expect(used).toContain("2 échanges");
  });
});

describe("projection publique d'un espace", () => {
  const secret = "PROMPT-SYSTEME-CONFIDENTIEL";
  const cv = "Charles de Cassan — CV intégral, 15 ans d'expérience…";

  const espace = {
    icon: "🧭",
    name: "Radar Emploi",
    gent: "Radar Emploi",
    version: 3,
    status: "active",
    statusLabel: "Publié",
    sensitive: false,
    metrics: [],
    integrations: [],
    tools: [],
    tabs: [],
    map: null,
    memory: "Note privée du créateur",
    conversations: [{ id: "c1", startedAt: "hier", messages: [{ role: "user", text: "<p>secret</p>" }] }],
    activeConversationId: "c1",
    files: [{ id: "f1", name: "cv.pdf", size: 1, date: "hier" }],
    artefacts: [{ id: "a1", title: "Ancien rapport", type: "report", icon: "📄", date: "hier" }],
    systemPrompt: secret,
    chatModelId: "anthropic/claude-sonnet-5",
    webSearch: true,
    profile: { metier: "Solution Consultant" },
    mcpServers: [{ name: "interne", url: "https://interne.exemple/mcp" }],
    datasets: [{ name: "dvf", url: "https://data.exemple/dvf" }],
    restApis: [
      {
        name: "Adzuna",
        config: {
          method: "GET",
          baseUrl: "https://api.adzuna.com/v1",
          description: "",
          queryParams: [],
          headers: [],
          auth: { mode: "api-key", placement: "query", fieldName: "app_key", value: "CLE-SECRETE-REELLE" },
          modelParams: [],
        },
      },
    ],
    routine: { enabled: true, frequency: "weekly", hour: 8, mission: "veille" },
    channel: { kind: "email", enabled: true, to: "charles@exemple.fr" },
    pinnedArtefact: {
      enabled: true,
      title: "Tableau de bord carrière",
      mission: "MISSION-CONFIDENTIELLE",
      inputs: [{ id: "cv", label: "Votre CV", kind: "file", value: cv }],
      dashboard: { blocks: [{ type: "text", body: "Rendu public" }] },
      generatedAt: "2026-07-30T08:00:00Z",
      runs: [{ at: "2026-07-30T08:00:00Z", ok: true, note: "ok — 1 blocs" }],
    },
  } as unknown as Espace;

  const pub = espaceForPublicLink(espace);
  const serialized = JSON.stringify(pub);

  it("ne laisse fuir ni le prompt système ni la mission de l'artefact", () => {
    expect(pub.systemPrompt).toBeUndefined();
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("MISSION-CONFIDENTIELLE");
    expect(pub.pinnedArtefact?.mission).toBe("");
  });

  it("ne laisse fuir ni le profil, ni la mémoire, ni les conversations, ni les fichiers", () => {
    expect(pub.profile).toBeUndefined();
    expect(pub.memory).toBe("");
    expect(pub.conversations).toEqual([]);
    expect(pub.files).toEqual([]);
    expect(pub.artefacts).toEqual([]);
    expect(serialized).not.toContain("Note privée");
    expect(serialized).not.toContain("Ancien rapport");
  });

  it("ne laisse fuir aucun secret de connecteur", () => {
    expect(pub.restApis).toBeUndefined();
    expect(pub.mcpServers).toBeUndefined();
    expect(pub.datasets).toBeUndefined();
    expect(serialized).not.toContain("CLE-SECRETE-REELLE");
  });

  it("ne laisse fuir ni la configuration de diffusion ni l'historique des runs", () => {
    expect(pub.routine).toBeUndefined();
    expect(pub.channel).toBeUndefined();
    expect(serialized).not.toContain("charles@exemple.fr");
    expect(pub.pinnedArtefact?.runs).toBeUndefined();
  });

  it("vide la valeur des entrées mais conserve leurs libellés", () => {
    expect(serialized).not.toContain(cv);
    expect(pub.pinnedArtefact?.inputs).toEqual([{ id: "cv", label: "Votre CV", kind: "file" }]);
  });

  it("n'expose jamais le dashboard déjà généré par le créateur — le visiteur doit repartir vierge", () => {
    expect(pub.pinnedArtefact?.dashboard).toBeUndefined();
    expect(pub.pinnedArtefact?.generatedAt).toBeUndefined();
    expect(serialized).not.toContain("Rendu public");
  });

  it("conserve ce qui est nécessaire à l'affichage", () => {
    expect(pub.name).toBe("Radar Emploi");
    expect(pub.icon).toBe("🧭");
    expect(pub.pinnedArtefact?.title).toBe("Tableau de bord carrière");
  });
});
