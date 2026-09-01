import { DERNIER_COMPTE, belongsTo, scopedKey, staleScopedKeys } from "@/lib/storageScope";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

describe("clés cloisonnées par compte", () => {
  it("insère l'identifiant du compte dans la clé", () => {
    expect(scopedKey("getgents:published-gents", ALICE)).toBe(
      `getgents:${ALICE}:published-gents`
    );
    expect(scopedKey("getgents:gent-drafts", BOB)).toBe(`getgents:${BOB}:gent-drafts`);
  });

  it("garde la clé nue sans compte connu", () => {
    // Mode maquette, ou avant que la session soit lue : il n'y a alors
    // personne à cloisonner.
    expect(scopedKey("getgents:published-gents", null)).toBe("getgents:published-gents");
  });

  it("reconnaît à qui appartient une clé", () => {
    const cle = scopedKey("getgents:published-gents", ALICE);
    expect(belongsTo(cle, ALICE)).toBe(true);
    expect(belongsTo(cle, BOB)).toBe(false);
  });
});

describe("clés à purger", () => {
  const toutes = [
    scopedKey("getgents:published-gents", ALICE),
    scopedKey("getgents:gent-drafts", ALICE),
    scopedKey("getgents:published-gents", BOB),
    "getgents:published-gents", // héritée d'avant le cloisonnement
    "getgents:app-secret", // vestige du secret d'instance
    DERNIER_COMPTE,
    "autre-application:donnees",
  ];

  it("ne garde que les clés du compte courant", () => {
    // Le scénario à ne pas rater : Bob se connecte sur la machine d'Alice.
    const aPurger = staleScopedKeys(toutes, BOB);
    expect(aPurger).toContain(scopedKey("getgents:published-gents", ALICE));
    expect(aPurger).toContain(scopedKey("getgents:gent-drafts", ALICE));
    expect(aPurger).not.toContain(scopedKey("getgents:published-gents", BOB));
  });

  it("emporte les clés nues d'avant le cloisonnement", () => {
    expect(staleScopedKeys(toutes, BOB)).toContain("getgents:published-gents");
    expect(staleScopedKeys(toutes, BOB)).toContain("getgents:app-secret");
  });

  it("efface tout à la déconnexion", () => {
    const aPurger = staleScopedKeys(toutes, null);
    expect(aPurger).toContain(scopedKey("getgents:published-gents", ALICE));
    expect(aPurger).toContain(scopedKey("getgents:published-gents", BOB));
    expect(aPurger).toContain("getgents:published-gents");
  });

  it("ne touche jamais aux clés d'une autre application", () => {
    for (const compte of [ALICE, BOB, null]) {
      expect(staleScopedKeys(toutes, compte)).not.toContain("autre-application:donnees");
    }
  });

  it("préserve la mémoire du dernier compte, qui sert à détecter le changement", () => {
    // L'effacer ferait perdre la comparaison qui déclenche la purge elle-même.
    for (const compte of [ALICE, BOB, null]) {
      expect(staleScopedKeys(toutes, compte)).not.toContain(DERNIER_COMPTE);
    }
  });
});
