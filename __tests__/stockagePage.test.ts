import { CLE_MAX, CLES_MAX, TOTAL_MAX, VALEUR_MAX, debitAdmis, ecritureAdmise, lireDemandeStockage } from "@/lib/stockagePage";
import { AMORCE_ARTEFACT } from "@/lib/documentArtefact";

describe("stockage partagé d'une page (23/11)", () => {
  it("lit les quatre opérations et refuse le reste", () => {
    expect(lireDemandeStockage({ op: "get", cle: "votes" })).toEqual({ op: "get", cle: "votes" });
    expect(lireDemandeStockage({ op: "set", cle: "v:1", valeur: "{}" })).toEqual({ op: "set", cle: "v:1", valeur: "{}" });
    expect(lireDemandeStockage({ op: "delete", cle: "v:1" })).toEqual({ op: "delete", cle: "v:1" });
    expect(lireDemandeStockage({ op: "list", prefixe: "v:" })).toEqual({ op: "list", prefixe: "v:" });
    expect(lireDemandeStockage({ op: "drop" })).toBe("requete");
    expect(lireDemandeStockage(null)).toBe("requete");
  });

  it("borne clés et valeurs", () => {
    expect(lireDemandeStockage({ op: "get", cle: "" })).toBe("cle");
    expect(lireDemandeStockage({ op: "get", cle: "x".repeat(CLE_MAX + 1) })).toBe("cle");
    expect(lireDemandeStockage({ op: "set", cle: "a", valeur: "x".repeat(VALEUR_MAX + 1) })).toBe("valeur");
    // Une valeur non textuelle est sérialisée, comme dans Claude.
    expect(lireDemandeStockage({ op: "set", cle: "a", valeur: { n: 1 } })).toEqual({ op: "set", cle: "a", valeur: '{"n":1}' });
  });

  it("plafonne le nombre de clés et le volume d'une page", () => {
    const pleine = new Map(Array.from({ length: CLES_MAX }, (_, i) => [`k${i}`, 1] as [string, number]));
    expect(ecritureAdmise(pleine, "nouvelle", 1)).toBe("cles_max");
    expect(ecritureAdmise(pleine, "k3", 10)).toBeNull(); // réécrire une clé existante reste permis
    const lourde = new Map([["a", TOTAL_MAX - 10]]);
    expect(ecritureAdmise(lourde, "b", 11)).toBe("total_max");
    expect(ecritureAdmise(lourde, "a", TOTAL_MAX)).toBeNull(); // remplace sa propre taille
  });

  it("limite le débit d'écriture sur une minute glissante", () => {
    let h: number[] = [];
    for (let i = 0; i < 3; i++) h = debitAdmis(h, 1000 + i, 3).restants;
    expect(debitAdmis(h, 2000, 3).admis).toBe(false);
    expect(debitAdmis(h, 1000 + 61_000, 3).admis).toBe(true);
  });

  it("l'amorce relaie window.storage au parent, avec repli en mémoire", () => {
    expect(AMORCE_ARTEFACT).toContain('"stockage?"');
    expect(AMORCE_ARTEFACT).toContain('"stockage:reponse"');
    expect(AMORCE_ARTEFACT).toMatch(/window\.storage/);
  });
});
