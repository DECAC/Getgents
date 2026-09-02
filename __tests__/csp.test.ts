import { politiqueCsp, nouveauNonce } from "@/lib/csp";

function directives(csp: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of csp.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [nom, ...valeurs] = part.split(/\s+/);
    out[nom] = valeurs.join(" ");
  }
  return out;
}

const NONCE = "abc123";

describe("politiqueCsp", () => {
  const d = directives(politiqueCsp({ nonce: NONCE }));

  it("porte le nonce du tour et strict-dynamic", () => {
    expect(d["script-src"]).toContain(`'nonce-${NONCE}'`);
    expect(d["script-src"]).toContain("'strict-dynamic'");
  });

  it("ferme les vecteurs qui n'ont aucun usage légitime ici", () => {
    expect(d["object-src"]).toBe("'none'");
    expect(d["base-uri"]).toBe("'self'");
    expect(d["form-action"]).toBe("'self'");
    expect(d["default-src"]).toBe("'self'");
  });

  it("autorise ce dont l'application a réellement besoin", () => {
    // Chacune de ces autorisations a été constatée, pas supposée.
    expect(d["style-src"]).toContain("https://fonts.googleapis.com");
    expect(d["font-src"]).toContain("https://fonts.gstatic.com");
    expect(d["frame-src"]).toContain("https://challenges.cloudflare.com");
    expect(d["worker-src"]).toContain("blob:");
    expect(d["img-src"]).toContain("data:");
  });

  it("refuse l'encadrement par défaut, l'autorise pour un lien de partage", () => {
    expect(d["frame-ancestors"]).toBe("'self'");
    expect(directives(politiqueCsp({ nonce: NONCE, encadrable: true }))["frame-ancestors"]).toBe("*");
  });

  it("n'annonce jamais deux politiques concurrentes", () => {
    // Deux en-têtes CSP s'intersectent : le plus restrictif gagne, et un
    // `frame-ancestors *` posé ailleurs serait annulé sans bruit. La politique
    // doit donc être produite ICI et nulle part ailleurs.
    const csp = politiqueCsp({ nonce: NONCE, encadrable: true });
    expect(csp.match(/frame-ancestors/g)).toHaveLength(1);
  });

  it("ne laisse jamais un nonce vide passer pour valide", () => {
    // Un `'nonce-'` vide serait accepté par le navigateur comme une valeur
    // littérale, que n'importe quel script injecté pourrait recopier.
    expect(politiqueCsp({ nonce: "" })).toContain("'nonce-'");
    expect(nouveauNonce().length).toBeGreaterThan(15);
  });
});

describe("nouveauNonce", () => {
  it("ne se répète pas", () => {
    const vus = new Set(Array.from({ length: 200 }, () => nouveauNonce()));
    expect(vus.size).toBe(200);
  });

  it("ne produit que des caractères sûrs dans un en-tête", () => {
    for (let i = 0; i < 50; i++) {
      // Ni espace, ni point-virgule, ni apostrophe : sinon le nonce
      // découperait l'en-tête et l'on écrirait une directive de plus.
      expect(nouveauNonce()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});
