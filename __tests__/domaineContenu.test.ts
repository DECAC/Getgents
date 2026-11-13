import { empreinteBrouillon, lireAdresse, signerAdresse, DUREE_ADRESSE_MS } from "@/lib/adresseSignee";
import { estDomaineContenu, lireDomaineContenu, origineAppValide } from "@/lib/domaineContenu";
import { cspArtefact, CSP_ARTEFACT } from "@/lib/documentArtefact";
import { politiqueCsp } from "@/lib/csp";

const CLE = "cle-de-test";
const O = "https://getgents.ai";
const T0 = 1_700_000_000_000;

describe("domaine de contenu", () => {
  it("lit DOMAINE_CONTENU, https en production, http en local seulement", () => {
    expect(lireDomaineContenu("getgents-pages.com")).toEqual({ hote: "getgents-pages.com", nom: "getgents-pages.com", origine: "https://getgents-pages.com" });
    expect(lireDomaineContenu(" https://Getgents-Pages.com/ ")?.origine).toBe("https://getgents-pages.com");
    expect(lireDomaineContenu("127.0.0.1:4083")).toEqual({ hote: "127.0.0.1:4083", nom: "127.0.0.1", origine: "http://127.0.0.1:4083" });
    expect(lireDomaineContenu(undefined)).toBeNull();
    expect(lireDomaineContenu("")).toBeNull();
    expect(lireDomaineContenu("pas un domaine")).toBeNull();
    expect(lireDomaineContenu("getgents-pages.com/chemin")).toBeNull();
    expect(lireDomaineContenu("intranet")).toBeNull();
    // Un port n'a de sens qu'en local.
    expect(lireDomaineContenu("getgents-pages.com:8443")).toBeNull();
  });

  it("reconnaît la requête qui vise le domaine de contenu, et elle seule", () => {
    const d = lireDomaineContenu("getgents-pages.com");
    expect(estDomaineContenu("getgents-pages.com", d)).toBe(true);
    expect(estDomaineContenu("GETGENTS-PAGES.COM", d)).toBe(true);
    expect(estDomaineContenu("getgents.ai", d)).toBe(false);
    expect(estDomaineContenu("getgents-pages.com", null)).toBe(false);
    expect(estDomaineContenu(null, d)).toBe(false);
  });

  it("n'accepte comme encadrant qu'une origine https, ou locale", () => {
    expect(origineAppValide("https://getgents.ai")).toBe(true);
    expect(origineAppValide("http://localhost:3000")).toBe(true);
    expect(origineAppValide("http://getgents.ai")).toBe(false);
    expect(origineAppValide("https://getgents.ai; script-src *")).toBe(false);
    expect(origineAppValide("*")).toBe(false);
  });
});

describe("adresses signées", () => {
  const signer = (o: Parameters<typeof signerAdresse>[0]) => signerAdresse(o, { cle: CLE, origineApp: O, maintenant: T0 });

  it("rend ce qui a été signé, avec l'origine qui peut encadrer", () => {
    const r = lireAdresse(signer({ t: "partage", j: "abcdefghijklmnopqrstuvwx" }), CLE, T0 + 1000);
    expect(r).toEqual({ ok: true, adresse: { t: "partage", j: "abcdefghijklmnopqrstuvwx", o: O, e: T0 + DUREE_ADRESSE_MS } });
    const p = lireAdresse(signer({ t: "page", id: "0f8fad5b-d9cb-469f-a165-70867728950e", u: "u1" }), CLE, T0);
    expect(p.ok && p.adresse.t === "page" && p.adresse.u).toBe("u1");
  });

  it("refuse une adresse expirée, retouchée, ou signée avec une autre clé", () => {
    const a = signer({ t: "partage", j: "abcdefghijklmnopqrstuvwx" });
    expect(lireAdresse(a, CLE, T0 + DUREE_ADRESSE_MS + 1)).toEqual({ ok: false, raison: "expiree" });
    expect(lireAdresse(a, "autre-cle", T0)).toEqual({ ok: false, raison: "signature" });
    // Changer le lien visé sans resigner.
    const [, sig] = a.split(".");
    const autre = Buffer.from(JSON.stringify({ t: "partage", j: "zzzzzzzzzzzzzzzzzzzzzzzz", o: O, e: T0 + DUREE_ADRESSE_MS })).toString("base64url");
    expect(lireAdresse(`${autre}.${sig}`, CLE, T0)).toEqual({ ok: false, raison: "signature" });
    expect(lireAdresse("introuvable", CLE, T0).ok).toBe(false);
    expect(lireAdresse("a.b.c", CLE, T0).ok).toBe(false);
    expect(lireAdresse(a, "", T0).ok).toBe(false);
  });

  it("ne signe pas sans clé ni pour une origine douteuse", () => {
    expect(() => signerAdresse({ t: "partage", j: "abcdefghijklmnopqrstuvwx" }, { cle: "", origineApp: O, maintenant: T0 })).toThrow();
    expect(() => signerAdresse({ t: "partage", j: "abcdefghijklmnopqrstuvwx" }, { cle: CLE, origineApp: "https://x.fr *", maintenant: T0 })).toThrow();
  });

  it("refuse un objet mal formé même correctement signé", () => {
    const r = lireAdresse(signer({ t: "page", id: "pas-un-uuid", u: "u1" }), CLE, T0);
    expect(r).toEqual({ ok: false, raison: "forme" });
  });

  it("l'empreinte d'un brouillon change dès qu'un champ change", () => {
    const h = empreinteBrouillon("<p>a</p>", "html", "T");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteBrouillon("<p>a</p>", "html", "T")).toBe(h);
    expect(empreinteBrouillon("<p>b</p>", "html", "T")).not.toBe(h);
    expect(empreinteBrouillon("<p>a</p>", "svg", "T")).not.toBe(h);
    // Les champs ne se confondent pas en se décalant.
    expect(empreinteBrouillon("ab", "c", "")).not.toBe(empreinteBrouillon("a", "bc", ""));
  });
});

describe("politiques", () => {
  it("le document garde son bac à sable, et nomme qui peut l'encadrer", () => {
    expect(CSP_ARTEFACT).toContain("frame-ancestors 'self'");
    const c = cspArtefact("https://getgents.ai");
    expect(c).toContain("frame-ancestors https://getgents.ai");
    expect(c).toMatch(/^sandbox allow-scripts/);
    expect(c).not.toContain("allow-same-origin");
  });

  it("l'application peut encadrer le domaine de contenu et y reposter l'aperçu, rien de plus", () => {
    const sans = politiqueCsp({ nonce: "n" });
    expect(sans).toContain("form-action 'self';");
    const avec = politiqueCsp({ nonce: "n", origineContenu: "https://getgents-pages.com" });
    expect(avec).toContain("form-action 'self' https://getgents-pages.com");
    expect(avec).toMatch(/frame-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/getgents-pages\.com/);
    expect(avec).toContain("frame-ancestors 'self'");
  });
});

describe("politique en développement", () => {
  it("ne lève le passage forcé en https que pour un domaine de contenu local", () => {
    expect(politiqueCsp({ nonce: "n", origineContenu: "https://getgents-pages.com" })).toContain("upgrade-insecure-requests");
    expect(politiqueCsp({ nonce: "n" })).toContain("upgrade-insecure-requests");
    expect(politiqueCsp({ nonce: "n", origineContenu: "http://127.0.0.1:4083" })).not.toContain("upgrade-insecure-requests");
  });
});
