import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Test de discipline, sur le modèle de openRouterDiscipline.
 *
 * Les jetons OAuth donnent accès à la boîte mail des utilisateurs. Ils ont été
 * stockés en clair pendant plusieurs mois, et le seul moyen de garantir que ça
 * ne recommence pas est de le vérifier mécaniquement : une relecture attentive
 * ne se répète pas à chaque modification, un test si.
 */

const SOURCE = join(process.cwd(), "lib/server/integrationCredentials.ts");
const code = readFileSync(SOURCE, "utf8");

describe("chiffrement des jetons OAuth", () => {
  it("chiffre les deux jetons à l'écriture", () => {
    expect(code).toContain("access_token: chiffrer(cred.accessToken)");
    expect(code).toContain("chiffrer(cred.refreshToken)");
  });

  it("n'écrit jamais un jeton brut", () => {
    // On isole le bloc d'ÉCRITURE : deux essais précédents visaient soit le
    // fichier entier — attrapant la version chiffrée elle-même — soit la
    // première ligne « access_token: », qui est la déclaration de type. Un
    // test approximatif finit désactivé, ce qui vaut moins que pas de test.
    const bloc = code.slice(code.indexOf(".upsert("));
    for (const champ of ["access_token:", "refresh_token:"]) {
      const ligne = bloc.split("\n").find((l) => l.trim().startsWith(champ));
      expect(ligne).toBeDefined();
      expect(ligne!).toContain("chiffrer(");
    }
  });

  it("refuse d'enregistrer sans clé de chiffrement", () => {
    // Un repli silencieux en clair rétablirait le problème tout en donnant
    // l'illusion qu'il est réglé — le pire des deux échecs possibles.
    expect(code).toContain("if (!secretBoxConfigure())");
  });

  it("sait encore lire les lignes héritées", () => {
    // Sans cette tolérance, la migration coupait Gmail pour tous les comptes
    // déjà connectés, d'un coup et sans avertissement.
    expect(code).toContain("enc_version");
    expect(code).toMatch(/chiffree \? dechiffrer\(row\.access_token\)/);
  });

  it("est le SEUL endroit qui touche à cette table", () => {
    // Un second point d'accès contournerait tout ce qui précède.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const sortie = execSync(
      "grep -rl 'integration_credentials' --include=*.ts lib app 2>/dev/null || true",
      { cwd: process.cwd(), encoding: "utf8" }
    );
    const fichiers = sortie
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      // gmail.ts ne fait que citer le nom de la table dans un message d'aide.
      .filter((f) => f !== "lib/server/gmail.ts");
    expect(fichiers).toEqual(["lib/server/integrationCredentials.ts"]);
  });
});
