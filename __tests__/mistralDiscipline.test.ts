import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Une seule porte vers la clé Mistral (Publiciste) : même discipline que pour
 * OpenRouter. Mistral est TOUJOURS payé par la plateforme ; une lecture
 * dispersée de la clé ferait un chemin de facturation sans plafond.
 */
const AUTORISES = ["lib/server/mistral.ts"];

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir)) {
    if (entree === "node_modules" || entree.startsWith(".")) continue;
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (/\.tsx?$/.test(entree)) acc.push(chemin);
  }
  return acc;
}

describe("clé Mistral", () => {
  it("n'est lue que par lib/server/mistral.ts", () => {
    const fautifs = ["app", "lib", "components"]
      .flatMap((r) => fichiers(r))
      .filter((f) => readFileSync(f, "utf8").includes("MISTRAL_API_KEY"))
      .filter((f) => !AUTORISES.includes(f));
    expect(fautifs).toEqual([]);
  });

  it("le plafond horaire compte par compte et repart à l'heure suivante", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { compterPhrase, PLAFOND_PHRASES_PAR_HEURE } = require("@/lib/server/mistral");
    const t = 3_600_000 * 1000;
    for (let i = 0; i < PLAFOND_PHRASES_PAR_HEURE; i++) expect(compterPhrase("a", t)).toBe(true);
    expect(compterPhrase("a", t)).toBe(false);
    expect(compterPhrase("b", t)).toBe(true);
    expect(compterPhrase("a", t + 3_600_000)).toBe(true);
  });
});
