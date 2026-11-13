import { cheminReserveAuxGents, comptesComplets, debutDuMois, messagePlafond, offreDuCompte, PlafondAtteint, plafondsDe, PLAFONDS_PAGES } from "@/lib/offre";
import { readFileSync } from "fs";

describe("offre d'un compte", () => {
  it("sans liste, tout le monde garde l'accès complet (l'état d'avant)", () => {
    expect(offreDuCompte("abc", undefined)).toBe("complete");
    expect(offreDuCompte("abc", "")).toBe("complete");
    expect(offreDuCompte(null, "  ")).toBe("complete");
  });

  it("avec une liste, seuls les comptes listés sont complets", () => {
    const liste = "0f8fad5b-d9cb-469f-a165-70867728950e, 7c9e6679-7425-40de-944b-e07fc1f90ae7";
    expect(offreDuCompte("0f8fad5b-d9cb-469f-a165-70867728950e", liste)).toBe("complete");
    expect(offreDuCompte("7C9E6679-7425-40DE-944B-E07FC1F90AE7", liste)).toBe("complete");
    expect(offreDuCompte("autre", liste)).toBe("pages");
    expect(offreDuCompte(null, liste)).toBe("pages");
    expect(comptesComplets("a;b c,d")?.size).toBe(4);
  });

  it("plafonds de l'offre pages, aucun pour l'offre complète", () => {
    expect(plafondsDe("pages")).toEqual({ pages: 50, liensActifs: 200, questionsParMois: 500 });
    expect(plafondsDe("complete")).toBeNull();
    expect(PLAFONDS_PAGES.pages).toBe(50);
  });

  it("ferme les pages des gents, pas la rubrique Pages ni le compte", () => {
    for (const c of ["/builder", "/builder/mesgents", "/espace/abc", "/apercu/x", "/accueil", "/myspace"]) expect(cheminReserveAuxGents(c)).toBe(true);
    for (const c of ["/pages", "/pages/abc", "/compte", "/partage/x", "/oauth/autoriser", "/connexion", "/mon-gent", "/accueil-x"]) expect(cheminReserveAuxGents(c)).toBe(false);
  });

  it("un plafond atteint dit quoi faire, et que l'existant reste en ligne", () => {
    const e = new PlafondAtteint("pages", 50);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toMatch(/50 pages/);
    expect(e.message).toMatch(/restent en ligne/);
    expect(messagePlafond("liensActifs", 200)).toMatch(/révoquez/);
    expect(messagePlafond("questionsParMois", 500)).toMatch(/1er du mois/);
  });

  it("le mois commence le 1er, heure de Paris", () => {
    expect(debutDuMois(new Date("2026-11-13T10:00:00Z"))).toBe("2026-11-01");
    // 31 octobre 23 h 30 UTC = 1er novembre 0 h 30 à Paris.
    expect(debutDuMois(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11-01");
  });

  it("les trois gardes des gents vérifient l'offre", () => {
    const src = readFileSync("lib/server/gentGuard.ts", "utf8");
    for (const g of ["requireGentAccess", "requireDraftOwner", "requireGentOrDraftAccess", "requireUserWithQuota"]) {
      const corps = src.slice(src.indexOf(`export async function ${g}`));
      const fin = corps.indexOf("\nexport ", 10);
      expect(corps.slice(0, fin > 0 ? fin : undefined)).toContain("refusOffrePages(auth.user.id)");
    }
  });
});

describe("routes qui facturent un modèle", () => {
  it("toute route qui résout sa facturation à la main vérifie l'offre", () => {
    const { execSync } = require("child_process");
    const fichiers: string[] = execSync("grep -rl 'consommerSiPlateforme' app/api || true", { encoding: "utf8" }).split("\n").filter(Boolean);
    const gardes = ["requireUserWithQuota(", "requireGentAccess(", "requireDraftOwner(", "requireGentOrDraftAccess(", "refusOffrePages("];
    // Exceptions : lecture de la consommation, et l'assistant des PAGES (payé par l'auteur, plafonné à part).
    const exceptions = ["app/api/compte/consommation/route.ts", "app/api/partage/[jeton]/assistant/route.ts"];
    const sansGarde = fichiers.filter((f) => !exceptions.includes(f) && !gardes.some((g) => readFileSync(f, "utf8").includes(g)));
    expect(sansGarde).toEqual([]);
  });
});
