import { diagnostiquerTurnstile } from "@/lib/turnstileErreurs";

describe("diagnostiquerTurnstile", () => {
  it("reconnaît un domaine non autorisé", () => {
    // 110200 : la clé de site n'accepte pas le domaine d'où vient la page.
    // C'est ce qui arrive après un changement de domaine — la clé restait
    // déclarée pour l'ancien.
    const d = diagnostiquerTurnstile("110200");
    expect(d.cotePlateforme).toBe(true);
    expect(d.message).toMatch(/de notre côté/i);
  });

  it("traite les variantes suffixées du même code", () => {
    // Cloudflare renvoie parfois « 110200 » et parfois « 110200-abc ».
    expect(diagnostiquerTurnstile("110200-1").cotePlateforme).toBe(true);
  });

  it("reconnaît une clé de site invalide", () => {
    expect(diagnostiquerTurnstile("110100").cotePlateforme).toBe(true);
  });

  it("ne demande jamais au visiteur de réparer notre configuration", () => {
    // Lui dire « réessayez » sur une erreur de config le ferait tourner en
    // rond : aucun nombre de tentatives ne corrigera la clé.
    expect(diagnostiquerTurnstile("110200").message).not.toMatch(/réessayez/i);
  });

  it("propose de réessayer sur un échec passager", () => {
    expect(diagnostiquerTurnstile("300010").cotePlateforme).toBe(false);
    expect(diagnostiquerTurnstile("600000").message).toMatch(/réessayez/i);
  });

  it("ne montre jamais le code brut au visiteur", () => {
    // Le code va dans la console pour nous ; l'écran reste lisible.
    for (const code of ["110200", "300010", "600000", ""]) {
      expect(diagnostiquerTurnstile(code).message).not.toContain(code || "@@");
    }
  });

  it("survit à une absence de code", () => {
    // Le callback peut être appelé sans argument : ne pas lever ici, sinon
    // l'échec du captcha devient un plantage de la page.
    expect(() => diagnostiquerTurnstile(undefined)).not.toThrow();
    expect(diagnostiquerTurnstile(undefined).cotePlateforme).toBe(false);
    expect(diagnostiquerTurnstile(42).cotePlateforme).toBe(false);
  });
});
