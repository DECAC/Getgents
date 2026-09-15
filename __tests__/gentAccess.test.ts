import {
  canAdminister,
  canRead,
  canWrite,
  resolveAccess,
  type GentAccessInput,
  type GentGrant,
} from "@/lib/gentAccess";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

function acces(partial: Partial<GentAccessInput> = {}) {
  return resolveAccess({
    ownerId: ALICE,
    visibility: "private",
    grants: [],
    userId: null,
    userEmail: null,
    ...partial,
  });
}

function invitation(partial: Partial<GentGrant> = {}): GentGrant {
  return { granteeId: null, invitedEmail: "bob@exemple.fr", role: "viewer", revokedAt: null, ...partial };
}

describe("rôle sur un gent", () => {
  it("reconnaît le propriétaire", () => {
    expect(acces({ userId: ALICE })).toBe("owner");
  });

  it("ne donne rien à un tiers sur un gent privé", () => {
    expect(acces({ userId: BOB, userEmail: "bob@exemple.fr" })).toBe("none");
    expect(acces({ userId: null })).toBe("none");
  });

  it("applique une invitation scellée sur le compte", () => {
    const grants = [invitation({ granteeId: BOB, role: "editor" })];
    expect(acces({ userId: BOB, grants })).toBe("editor");
  });

  it("applique une invitation encore en attente, par l'adresse", () => {
    // Le cas courant : Bob vient de s'inscrire, le scellement n'a pas encore
    // eu lieu, il doit malgré tout voir le gent auquel on l'a invité.
    expect(acces({ userId: BOB, userEmail: "bob@exemple.fr", grants: [invitation()] })).toBe("viewer");
  });

  it("ignore une invitation révoquée", () => {
    const grants = [invitation({ granteeId: BOB, revokedAt: "2026-01-01" })];
    expect(acces({ userId: BOB, userEmail: "bob@exemple.fr", grants })).toBe("none");
  });

  it("n'accorde rien sur la seule foi d'une adresse non fournie", () => {
    // `userEmail` n'est renseigné par l'appelant que si l'adresse est
    // CONFIRMÉE. Sans confirmation, s'inscrire avec l'adresse d'autrui ne
    // doit donner aucun accès.
    expect(acces({ userId: BOB, userEmail: null, grants: [invitation()] })).toBe("none");
  });

  it("laisse un gent public se lire par n'importe qui, en lecture seule", () => {
    expect(acces({ visibility: "public", userId: null })).toBe("viewer");
    expect(acces({ visibility: "public", userId: BOB })).toBe("viewer");
    // Le propriétaire reste propriétaire de son gent public.
    expect(acces({ visibility: "public", userId: ALICE })).toBe("owner");
  });

  it("fait primer le rôle le plus fort", () => {
    // Invité en lecture sur un gent public : il reste viewer, sans dégât.
    // Mais un co-éditeur invité sur un gent public garde son droit d'écriture.
    const grants = [invitation({ granteeId: BOB, role: "editor" })];
    expect(acces({ visibility: "public", userId: BOB, grants })).toBe("editor");
  });

  it("ne suppose pas de propriétaire sur un gent orphelin", () => {
    // Les gents d'avant la reprise : personne n'en hérite par accident.
    expect(acces({ ownerId: null, userId: BOB })).toBe("none");
    expect(acces({ ownerId: null, userId: null })).toBe("none");
  });
});

describe("droits dérivés du rôle", () => {
  it("ouvre la lecture à tout rôle sauf none", () => {
    expect(["owner", "editor", "viewer"].every((r) => canRead(r as never))).toBe(true);
    expect(canRead("none")).toBe(false);
  });

  it("réserve l'écriture au propriétaire et au co-éditeur", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("editor")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("none")).toBe(false);
  });

  it("réserve la suppression, le partage et la publication au seul propriétaire", () => {
    // Un co-éditeur travaille sur le gent, il n'en dispose pas : il ne peut
    // ni le publier, ni le supprimer, ni inviter quelqu'un d'autre.
    expect(canAdminister("owner")).toBe(true);
    expect(canAdminister("editor")).toBe(false);
  });
});
