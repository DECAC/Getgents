import { createHmac } from "node:crypto";
import { decodeOAuthState, encodeOAuthState } from "@/lib/server/gmail";

/**
 * Le `state` OAuth portait un gentId en base64 non signé : forgeable à la
 * main, il permettait de rattacher un compte Google au gent d'un autre. Il est
 * maintenant signé et lié au compte qui a lancé la connexion.
 */
describe("état OAuth Gmail", () => {
  const avant = process.env.GOOGLE_CLIENT_SECRET;
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_SECRET = "secret-de-test";
  });
  afterAll(() => {
    if (avant === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = avant;
  });

  const USER = "11111111-1111-1111-1111-111111111111";

  it("transporte le gent ET le compte demandeur", () => {
    const parsed = decodeOAuthState(encodeOAuthState("voyage-v5", USER));
    expect(parsed).toEqual({ gentId: "voyage-v5", userId: USER });
  });

  it("refuse un état forgé à la main", () => {
    // L'attaque exacte que la signature ferme : écrire l'identifiant du gent
    // de quelqu'un d'autre et terminer le parcours Google chez soi.
    const forge = Buffer.from(
      JSON.stringify({ gentId: "gent-de-la-victime", userId: "moi", exp: Date.now() + 10_000 }),
      "utf8"
    ).toString("base64url");
    expect(decodeOAuthState(forge)).toBeNull();
    expect(decodeOAuthState(`${forge}.signature-inventee`)).toBeNull();
  });

  it("refuse un état signé avec une autre clé", () => {
    const payload = Buffer.from(
      JSON.stringify({ gentId: "x", userId: USER, exp: Date.now() + 10_000 }),
      "utf8"
    ).toString("base64url");
    const mauvaise = createHmac("sha256", "pas-la-bonne-cle").update(payload).digest("base64url");
    expect(decodeOAuthState(`${payload}.${mauvaise}`)).toBeNull();
  });

  it("refuse un état expiré, même correctement signé", () => {
    const payload = Buffer.from(
      JSON.stringify({ gentId: "x", userId: USER, exp: Date.now() - 1000 }),
      "utf8"
    ).toString("base64url");
    const signature = createHmac("sha256", "secret-de-test").update(payload).digest("base64url");
    expect(decodeOAuthState(`${payload}.${signature}`)).toBeNull();
  });

  it("refuse une charge utile incomplète", () => {
    expect(decodeOAuthState("")).toBeNull();
    expect(decodeOAuthState("nimportequoi")).toBeNull();
    const sansUser = Buffer.from(JSON.stringify({ gentId: "x", exp: Date.now() + 10_000 }), "utf8").toString(
      "base64url"
    );
    const sig = createHmac("sha256", "secret-de-test").update(sansUser).digest("base64url");
    expect(decodeOAuthState(`${sansUser}.${sig}`)).toBeNull();
  });
});
