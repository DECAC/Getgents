import {
  checkPublicHttpUrl,
  ipv4FromHostname,
  isPrivateHostname,
  connectorUrlPolicy,
  type UrlPolicy,
} from "@/lib/server/urlGuard";

const STRICT: UrlPolicy = { allowHttp: false, allowPrivateHosts: false };
const LOCAL: UrlPolicy = { allowHttp: true, allowPrivateHosts: true };

function refus(raw: string, policy: UrlPolicy = STRICT): string {
  const r = checkPublicHttpUrl(raw, policy);
  if (r.ok) throw new Error(`attendu refusé, accepté : ${raw}`);
  return r.reason;
}

describe("notations d'adresse IPv4", () => {
  it("reconnaît une IPv4 quelle que soit son écriture", () => {
    // 127.0.0.1 = 2130706433 = 0x7f.1 = 0177.1 : ne reconnaître que la forme
    // pointée laisserait passer toutes les autres.
    expect(ipv4FromHostname("127.0.0.1")).toBe(2130706433);
    expect(ipv4FromHostname("2130706433")).toBe(2130706433);
    expect(ipv4FromHostname("0x7f.0.0.1")).toBe(2130706433);
    expect(ipv4FromHostname("0177.0.0.1")).toBe(2130706433);
    expect(ipv4FromHostname("127.1")).toBe(2130706433);
  });

  it("ne prend pas un nom de domaine pour une adresse", () => {
    expect(ipv4FromHostname("api.exemple.fr")).toBeNull();
    expect(ipv4FromHostname("999.1.1.1")).toBeNull();
    expect(ipv4FromHostname("1.2.3.4.5")).toBeNull();
  });
});

describe("hôtes non publics", () => {
  it("repère les cibles d'exfiltration connues", () => {
    expect(isPrivateHostname("169.254.169.254")).toBe(true); // métadonnées cloud
    expect(isPrivateHostname("metadata.google.internal")).toBe(true);
    expect(isPrivateHostname("127.0.0.1")).toBe(true);
    expect(isPrivateHostname("2130706433")).toBe(true);
    expect(isPrivateHostname("10.1.2.3")).toBe(true);
    expect(isPrivateHostname("172.20.0.1")).toBe(true);
    expect(isPrivateHostname("192.168.1.1")).toBe(true);
    expect(isPrivateHostname("[::1]")).toBe(true);
    expect(isPrivateHostname("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateHostname("fd00::1")).toBe(true);
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("db.internal")).toBe(true);
    expect(isPrivateHostname("redis")).toBe(true); // nom sans point
  });

  it("laisse passer les hôtes réellement publics", () => {
    expect(isPrivateHostname("api.openrouter.ai")).toBe(false);
    expect(isPrivateHostname("data.economie.gouv.fr")).toBe(false);
    expect(isPrivateHostname("172.32.0.1")).toBe(false); // hors 172.16/12
    expect(isPrivateHostname("8.8.8.8")).toBe(false);
  });
});

describe("validation d'une URL de connecteur", () => {
  it("accepte une API publique en https", () => {
    const r = checkPublicHttpUrl("https://api.exemple.fr/v1/vols?a=1", STRICT);
    expect(r.ok).toBe(true);
  });

  it("refuse les cibles internes", () => {
    expect(refus("https://169.254.169.254/latest/meta-data/")).toContain("non public");
    expect(refus("https://127.0.0.1/admin")).toContain("non public");
    expect(refus("https://2130706433/")).toContain("non public");
  });

  it("refuse les schémas et ports détournés", () => {
    expect(refus("file:///etc/passwd")).toContain("Schéma");
    expect(refus("gopher://exemple.fr/")).toContain("Schéma");
    expect(refus("https://api.exemple.fr:6379/")).toContain("Port");
  });

  it("refuse le clair en production, l'accepte en local", () => {
    expect(refus("http://api.exemple.fr/")).toContain("clair");
    expect(checkPublicHttpUrl("http://localhost:3000/api", LOCAL).ok).toBe(true);
  });

  it("refuse des identifiants glissés dans l'URL", () => {
    // `https://user:pass@hôte` fuiterait le secret dans les journaux, et sert
    // à masquer l'hôte réel derrière une partie « utilisateur » crédible.
    expect(refus("https://admin:secret@api.exemple.fr/")).toContain("Identifiants");
  });

  it("donne un motif exploitable, pas un refus muet", () => {
    for (const url of ["file:///x", "https://127.0.0.1/", "https://a.fr:22/"]) {
      expect(refus(url).length).toBeGreaterThan(20);
    }
  });
});

describe("politique appliquée aux connecteurs", () => {
  it("est stricte en production", () => {
    const avant = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(connectorUrlPolicy()).toEqual({ allowHttp: false, allowPrivateHosts: false });
    } finally {
      (process.env as Record<string, string>).NODE_ENV = avant ?? "test";
    }
  });
});
