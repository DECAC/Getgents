import { USAGE_LIMITS, limitFor, quotaMessage, windowStart } from "@/lib/rateLimit";

describe("fenêtre de comptage", () => {
  it("aligne sur l'heure pleine, en UTC", () => {
    // Des fenêtres alignées permettent une seule ligne par compte et par
    // heure, sans historique à purger.
    expect(windowStart(new Date("2026-03-15T14:37:52.412Z"))).toBe("2026-03-15T14:00:00.000Z");
    expect(windowStart(new Date("2026-03-15T14:00:00.000Z"))).toBe("2026-03-15T14:00:00.000Z");
    expect(windowStart(new Date("2026-03-15T14:59:59.999Z"))).toBe("2026-03-15T14:00:00.000Z");
  });

  it("change de fenêtre au passage de l'heure", () => {
    const avant = windowStart(new Date("2026-03-15T14:59:59Z"));
    const apres = windowStart(new Date("2026-03-15T15:00:01Z"));
    expect(avant).not.toBe(apres);
  });
});

describe("plafonds", () => {
  it("sont plus larges pour le texte que pour l'image ou la vidéo", () => {
    // Un créateur enchaîne facilement des dizaines de tours en construisant
    // son gent ; une génération d'image ou une analyse vidéo coûte bien plus.
    expect(limitFor("llm")).toBeGreaterThan(limitFor("image"));
    expect(limitFor("image")).toBeGreaterThan(limitFor("video"));
  });

  it("restent des nombres finis et positifs", () => {
    for (const kind of Object.keys(USAGE_LIMITS) as (keyof typeof USAGE_LIMITS)[]) {
      expect(limitFor(kind)).toBeGreaterThan(0);
      expect(Number.isFinite(limitFor(kind))).toBe(true);
    }
  });
});

describe("message de refus", () => {
  it("dit quand réessayer, pas seulement non", () => {
    const msg = quotaMessage("llm", new Date("2026-03-15T14:30:00Z"));
    expect(msg).toContain("30 minute");
    expect(msg).toContain(String(limitFor("llm")));
  });

  it("nomme ce qui est plafonné", () => {
    expect(quotaMessage("image", new Date("2026-03-15T14:00:00Z"))).toContain("image");
    expect(quotaMessage("video", new Date("2026-03-15T14:00:00Z"))).toContain("vidéo");
  });

  it("n'annonce jamais zéro minute d'attente", () => {
    // Au ras de l'heure suivante, arrondir à zéro donnerait « réessayez dans
    // 0 minute », ce qui ne veut rien dire.
    const msg = quotaMessage("llm", new Date("2026-03-15T14:59:59.900Z"));
    expect(msg).toContain("1 minute");
    expect(msg).not.toContain("0 minute");
  });
});
