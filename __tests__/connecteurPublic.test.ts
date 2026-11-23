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

import { traiterMessage } from "@/lib/mcpPartage";

describe("annotations exigées par l'annuaire de Claude", () => {
  it("chaque outil a un titre (aussi dans les annotations) et une indication lecture seule ou destructeur", async () => {
    const ctx = {
      enregistrer: async () => null,
      mettreAJour: async () => null,
      lister: async () => [],
      revoquer: async () => false,
    } as unknown as Parameters<typeof traiterMessage>[1];
    const r = (await traiterMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx)) as {
      result: { tools: { name: string; title: string; description: string; annotations: Record<string, unknown> }[] };
    };
    expect(r.result.tools).toHaveLength(4);
    for (const o of r.result.tools) {
      expect(o.title).toBeTruthy();
      expect(o.annotations.title).toBe(o.title);
      expect(o.annotations.readOnlyHint === true || typeof o.annotations.destructiveHint === "boolean").toBe(true);
      expect(o.name.length).toBeLessThanOrEqual(64);
      // Pas de consigne de comportement en capitales (« IMPORTANT », « AVANT », « Ne dis jamais »).
      expect(o.description).not.toMatch(/IMPORTANT|AVANT|ne dis jamais|ne choisis jamais/i);
    }
    const maj = r.result.tools.find((o) => o.name === "mettre_a_jour_page");
    expect(maj?.annotations.destructiveHint).toBe(true);
  });
});
