import { diffusedEspace } from "@/lib/server/gentVersions";

// Ce sélecteur est le garde-fou entre le studio et les destinataires réels :
// une régression ici pousserait la version de travail du créateur — prompt à
// moitié réécrit compris — sur les liens de partage et WhatsApp.
describe("sélection de la version diffusée", () => {
  it("sert la version diffusée quand elle existe", () => {
    const row = {
      espace: { name: "travail en cours", systemPrompt: "brouillon" },
      diffused: { name: "version publique", systemPrompt: "stable" },
    };
    expect(diffusedEspace(row)?.name).toBe("version publique");
  });

  it("ignore la version de travail même quand elle est plus récente", () => {
    const row = {
      espace: { name: "v2 non diffusée", version: 9 },
      diffused: { name: "v1 diffusée", version: 1 },
    };
    expect(diffusedEspace(row)?.name).toBe("v1 diffusée");
  });

  it("retombe sur la version de travail pour les gents d'avant la séparation", () => {
    // Migration 004 : `diffused` est nullable, les gents déjà en ligne n'en
    // ont pas. Les couper casserait des liens déjà distribués.
    const row = { espace: { name: "gent historique" } };
    expect(diffusedEspace(row)?.name).toBe("gent historique");
  });

  it("retombe aussi quand diffused est null explicitement", () => {
    const row = { espace: { name: "gent historique" }, diffused: null };
    expect(diffusedEspace(row)?.name).toBe("gent historique");
  });

  it("renvoie null quand il n'y a rien à servir", () => {
    expect(diffusedEspace(null)).toBeNull();
    expect(diffusedEspace(undefined)).toBeNull();
    expect(diffusedEspace({})).toBeNull();
    expect(diffusedEspace({ espace: null, diffused: null })).toBeNull();
  });
});
