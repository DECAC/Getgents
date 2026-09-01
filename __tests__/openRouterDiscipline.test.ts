import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Une seule porte vers la clé de la plateforme.
 *
 * Ce test ne vérifie pas une logique, il vérifie une DISCIPLINE. Le défaut
 * d'origine n'était pas une clé mal utilisée : c'étaient dix lectures
 * dispersées de `process.env.OPENROUTER_API_KEY`, dont six dans des modules
 * qui ne savaient même pas pour qui ils travaillaient. Tant que la variable
 * reste lisible de partout, un chemin ajouté plus tard retombera dessus sans
 * bruit, et la plateforme se remettra à payer pour un builder qui croit régler
 * ses propres appels.
 *
 * Une dérive de facturation invisible est le pire résultat possible ici :
 * personne ne s'en plaint, et elle ne se voit que sur la facture. D'où ce
 * garde-fou mécanique.
 */

const AUTORISES = [
  // Le résolveur : contexteForUser / contexteForGent partent d'ici.
  "lib/server/openRouterKey.ts",
  // La liste blanche des variables lisibles depuis un connecteur la NOMME
  // précisément pour expliquer pourquoi elle en est absente.
  "lib/server/envAllowlist.ts",
];

const RACINES = ["app", "lib", "components"];

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir)) {
    if (entree === "node_modules" || entree.startsWith(".")) continue;
    const chemin = join(dir, entree);
    if (statSync(chemin).isDirectory()) fichiers(chemin, acc);
    else if (/\.tsx?$/.test(entree)) acc.push(chemin);
  }
  return acc;
}

describe("clé OpenRouter", () => {
  it("n'est lue qu'à un seul endroit", () => {
    const coupables: string[] = [];
    for (const racine of RACINES) {
      for (const f of fichiers(racine)) {
        if (AUTORISES.includes(f)) continue;
        if (readFileSync(f, "utf8").includes("process.env.OPENROUTER_API_KEY")) coupables.push(f);
      }
    }

    expect(coupables).toEqual([]);
  });

  it("reste hors de portée des connecteurs", () => {
    const { isAllowedEnvName } = require("@/lib/server/envAllowlist");
    expect(isAllowedEnvName("OPENROUTER_API_KEY")).toBe(false);
    expect(isAllowedEnvName("SECRET_BOX_KEY")).toBe(false);
  });
});
