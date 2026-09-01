import { chiffrer, dechiffrer, secretBoxConfigure, SecretBoxIndisponible } from "@/lib/server/secretBox";

const CLE = "0123456789abcdef0123456789abcdef";
const avant = process.env.SECRET_BOX_KEY;

beforeEach(() => {
  process.env.SECRET_BOX_KEY = CLE;
});

afterAll(() => {
  if (avant === undefined) delete process.env.SECRET_BOX_KEY;
  else process.env.SECRET_BOX_KEY = avant;
});

describe("secretBox", () => {
  it("fait l'aller-retour", () => {
    const secret = "sk-or-v1-" + "a".repeat(48);
    expect(dechiffrer(chiffrer(secret))).toBe(secret);
  });

  it("ne produit jamais deux fois le même chiffré pour la même valeur", () => {
    // Sans IV aléatoire, deux builders ayant la même clé se reconnaîtraient
    // dans la base, et un chiffré recopié d'une ligne à l'autre marcherait.
    expect(chiffrer("secret")).not.toBe(chiffrer("secret"));
  });

  it("laisse le clair invisible dans le chiffré", () => {
    expect(chiffrer("sk-or-motdepasse")).not.toMatch(/motdepasse/);
  });

  it("renvoie null sur un tag altéré plutôt que de lever", () => {
    const paquet = Buffer.from(chiffrer("secret"), "base64");
    paquet[paquet.length - 1] ^= 0xff;
    expect(dechiffrer(paquet.toString("base64"))).toBeNull();
  });

  it("renvoie null sur une entrée vide, tronquée ou absurde", () => {
    for (const v of [null, undefined, "", "pas du base64 !!", "AAAA"]) {
      expect(dechiffrer(v)).toBeNull();
    }
  });

  it("renvoie null quand la clé maîtresse a changé — jamais une valeur fausse", () => {
    const paquet = chiffrer("secret");
    process.env.SECRET_BOX_KEY = "un-tout-autre-secret-de-32-octets";
    expect(dechiffrer(paquet)).toBeNull();
  });

  it("refuse de chiffrer sans SECRET_BOX_KEY, plutôt que de stocker en clair", () => {
    delete process.env.SECRET_BOX_KEY;
    expect(secretBoxConfigure()).toBe(false);
    expect(() => chiffrer("secret")).toThrow(SecretBoxIndisponible);
    expect(dechiffrer("nimporte quoi")).toBeNull();
  });
});
