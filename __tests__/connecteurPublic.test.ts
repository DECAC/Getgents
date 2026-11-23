import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADRESSE_MCP, DESCRIPTION_REGISTRE, NOM_REGISTRE, OUTILS_PUBLICS } from "@/lib/connecteurPublic";
import { NOM_OUTIL, OUTIL_LISTER, OUTIL_METTRE_A_JOUR, OUTIL_REVOQUER } from "@/lib/mcpPartage";

const serveur = JSON.parse(readFileSync(join(process.cwd(), "server.json"), "utf8"));

describe("ce que Getgents dit publiquement de son connecteur", () => {
  it("server.json suit la source unique et les limites du registre", () => {
    expect(serveur.name).toBe(NOM_REGISTRE);
    expect(serveur.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(serveur.description).toBe(DESCRIPTION_REGISTRE);
    expect(DESCRIPTION_REGISTRE.length).toBeLessThanOrEqual(100);
    expect(serveur.remotes).toEqual([{ type: "streamable-http", url: ADRESSE_MCP }]);
  });

  it("le nom du registre est le domaine du connecteur à l'envers (preuve HTTP)", () => {
    const hote = new URL(ADRESSE_MCP).hostname.split(".").reverse().join(".");
    expect(NOM_REGISTRE.split("/")[0]).toBe(hote);
  });

  it("la documentation publique décrit exactement les outils annoncés", () => {
    expect(OUTILS_PUBLICS.map((o) => o.nom).sort()).toEqual([NOM_OUTIL, OUTIL_LISTER, OUTIL_METTRE_A_JOUR, OUTIL_REVOQUER].sort());
    expect(OUTILS_PUBLICS.find((o) => o.nom === OUTIL_REVOQUER)?.nature).toBe("destructeur");
    expect(OUTILS_PUBLICS.find((o) => o.nom === OUTIL_LISTER)?.nature).toBe("lecture seule");
  });

  it("ne promet jamais de publier « uniquement » ni d'envoyer des e-mails", () => {
    const tout = JSON.stringify(OUTILS_PUBLICS);
    expect(tout).not.toMatch(/uniquement/i);
    expect(tout).toMatch(/n'envoie aucun e-mail/);
  });
});
