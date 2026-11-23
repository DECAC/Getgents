import { signerJetonRappel, lireJetonRappel, VALIDITE_JETON_MS } from "@/lib/jetonRappel";
import { orchestrerRappels, AUTEURS_PAR_PASSAGE, type DepsRappels, type LienARappeler } from "@/lib/rappelsExpiration";
import { mailRappelExpiration, objetRappel, LIENS_PAR_MAIL } from "@/lib/emailRappelExpiration";

const CLE = "cle-de-test";
// 8 h à Paris en novembre (UTC+1) = 07:00 UTC.
const HUIT_HEURES = Date.parse("2026-11-23T07:10:00Z");
const NEUF_HEURES = Date.parse("2026-11-23T08:10:00Z");
const H = 3600 * 1000;

const lien = (n: number, o: Partial<LienARappeler> = {}): LienARappeler => ({
  jeton: `jeton${String(n).padStart(20, "0")}`,
  ownerId: "u1",
  destinataire: `Dest ${n}`,
  titrePage: "Devis",
  expiresAt: new Date(HUIT_HEURES + 30 * H).toISOString(),
  ...o,
});

function deps(liens: LienARappeler[], o: Partial<DepsRappels> = {}) {
  const marques: string[][] = [];
  const envoyes: { to: string; objet: string }[] = [];
  const d: DepsRappels = {
    liens: async () => liens,
    auteur: async () => ({ email: "a@x.fr", nom: "Ana", rappels: true }),
    envoyer: async (to, objet) => (envoyes.push({ to, objet }), { ok: true, note: "" }),
    marquer: async (j) => void marques.push(j),
    cle: CLE,
    origine: "https://getgents.ai",
    ...o,
  };
  return { d, marques, envoyes };
}

describe("jetons de rappel", () => {
  it("aller-retour, puis altération, expiration et mauvaise clé", () => {
    const t = signerJetonRappel({ t: "p", u: "u1", j: "a".repeat(24) }, { cle: CLE, maintenant: 1000 });
    expect(lireJetonRappel(t, CLE, 2000)).toMatchObject({ ok: true, jeton: { t: "p", u: "u1" } });
    expect(lireJetonRappel(t, "autre", 2000)).toEqual({ ok: false, raison: "signature" });
    expect(lireJetonRappel(t.replace(/^./, "x"), CLE, 2000).ok).toBe(false);
    expect(lireJetonRappel(t, CLE, 1000 + VALIDITE_JETON_MS + 1)).toEqual({ ok: false, raison: "expire" });
    expect(lireJetonRappel("n'importe quoi", CLE, 0).ok).toBe(false);
  });
  it("refuse de signer sans clé", () => {
    expect(() => signerJetonRappel({ t: "d", u: "u1" }, { cle: "", maintenant: 0 })).toThrow();
  });
});

describe("orchestration des rappels", () => {
  it("n'envoie rien hors de la fenêtre de 8 h (Paris)", async () => {
    const { d, envoyes } = deps([lien(1)]);
    const b = await orchestrerRappels(NEUF_HEURES, d);
    expect(b.fenetre).toBe(false);
    expect(envoyes).toHaveLength(0);
  });
  it("un seul e-mail par auteur, tous les liens marqués après succès", async () => {
    const { d, marques, envoyes } = deps([lien(1), lien(2), lien(3, { ownerId: "u2" })]);
    const b = await orchestrerRappels(HUIT_HEURES, d);
    expect(envoyes).toHaveLength(2);
    expect(b).toMatchObject({ auteurs: 2, envoyes: 2, liensMarques: 3 });
    expect(marques.flat()).toHaveLength(3);
  });
  it("un envoi en échec ne marque rien (nouvel essai à la prochaine fenêtre)", async () => {
    const { d, marques } = deps([lien(1)], { envoyer: async () => ({ ok: false, note: "401" }) });
    const b = await orchestrerRappels(HUIT_HEURES, d);
    expect(b.echecs).toBe(1);
    expect(marques).toHaveLength(0);
  });
  it("un auteur désabonné ou sans adresse confirmée est marqué sans envoi", async () => {
    for (const a of [{ email: "a@x.fr", nom: null, rappels: false }, { email: null, nom: null, rappels: true }]) {
      const { d, marques, envoyes } = deps([lien(1)], { auteur: async () => a });
      const b = await orchestrerRappels(HUIT_HEURES, d);
      expect(envoyes).toHaveLength(0);
      expect(marques).toHaveLength(1);
      expect(b.ignores).toBe(1);
    }
  });
  it("une lecture de compte en échec n'envoie ni ne marque", async () => {
    const { d, marques, envoyes } = deps([lien(1)], { auteur: async () => { throw new Error("x"); } });
    await orchestrerRappels(HUIT_HEURES, d);
    expect(envoyes).toHaveLength(0);
    expect(marques).toHaveLength(0);
  });
  it("plafonne les auteurs par passage", async () => {
    const liens = Array.from({ length: AUTEURS_PAR_PASSAGE + 5 }, (_, i) => lien(i, { ownerId: `u${i}` }));
    const { d, envoyes } = deps(liens);
    await orchestrerRappels(HUIT_HEURES, d);
    expect(envoyes).toHaveLength(AUTEURS_PAR_PASSAGE);
  });
  it("les jetons du mail sont valides et portent le bon compte", async () => {
    const { d } = deps([lien(1)]);
    const b = await orchestrerRappels(HUIT_HEURES, d, { garderMails: true });
    const urls = [...b.mails![0].html.matchAll(/partage\/rappel\/([A-Za-z0-9_.-]+)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const u of urls) expect(lireJetonRappel(u, CLE, HUIT_HEURES)).toMatchObject({ ok: true, jeton: { u: "u1" } });
  });
});

describe("e-mail de rappel", () => {
  const base = { total: 1, urlTout: "https://x/t", urlPages: "https://x/p", urlDesabonner: "https://x/d", nom: null };
  it("pluriel de l'objet", () => {
    expect(objetRappel(1)).toContain("1 de vos liens expire");
    expect(objetRappel(3)).toContain("3 de vos liens expirent");
  });
  it("échappe le HTML des titres et destinataires, et plafonne la liste", () => {
    const liens = Array.from({ length: LIENS_PAR_MAIL + 5 }, (_, i) => ({ destinataire: `<b>${i}</b>`, titrePage: "<script>x</script>", expiresAt: new Date(HUIT_HEURES).toISOString(), urlProlonger: `https://x/${i}` }));
    const m = mailRappelExpiration({ ...base, total: liens.length, liens: liens.slice(0, LIENS_PAR_MAIL) });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html.match(/https:\/\/x\/\d+/g)!.length).toBe(LIENS_PAR_MAIL);
  });
});
