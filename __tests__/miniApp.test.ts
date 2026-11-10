import {
  annulerDerniereMiseAJour,
  appliquerDonnees,
  avecNouveauTableau,
  completerAvecPrecedent,
  consigneDonnees,
  figerGabarit,
  resumeChangement,
  MAX_VERSIONS_MINI_APP,
} from "@/lib/miniApp";
import { parseDashboard, type DashboardSpec } from "@/lib/dashboardArtefact";
import { espaceForPublicLink, espaceForPinnedRefresh } from "@/lib/espaceApiPayload";
import { extractPinnedDashboard } from "@/lib/server/pinnedArtefact";
import type { Espace, PinnedArtefact } from "@/lib/types";

const tableau = (score: string, ville = "Lyon"): DashboardSpec =>
  parseDashboard({
    blocks: [
      { id: "titre", type: "heading", text: "Diagnostic" },
      { id: "chiffres", type: "stats", items: [{ label: "Score", value: score }] },
      { id: "detail", type: "table", title: "Opportunités", columns: ["Poste", "Ville"], rows: [["Chef de projet", ville]] },
      { id: "avis", type: "text", body: `Profil solide à ${ville}.` },
    ],
  })!;

const apercu = tableau("72", "Villeurbanne");
const gabarit = figerGabarit(apercu)!;

describe("figer la structure d'une mini-app", () => {
  it("garde la forme : identifiants, types, titres, libellés", () => {
    expect(gabarit.blocs.map((b) => [b.id, b.type])).toEqual([
      ["titre", "heading"],
      ["chiffres", "stats"],
      ["detail", "table"],
      ["avis", "text"],
    ]);
    expect(gabarit.blocs[1].champs).toEqual(["Score"]);
    expect(gabarit.blocs[2]).toMatchObject({ titre: "Opportunités", champs: ["Poste", "Ville"] });
  });

  it("ne garde AUCUNE donnée de l'aperçu du créateur", () => {
    const ecrit = JSON.stringify(gabarit) + consigneDonnees(gabarit);
    expect(ecrit).not.toContain("72");
    expect(ecrit).not.toContain("Villeurbanne");
    expect(ecrit).not.toContain("Chef de projet");
  });

  it("n'a rien à figer sans tableau", () => {
    expect(figerGabarit(null)).toBeNull();
  });

  it("la consigne nomme chaque bloc et interdit d'en changer", () => {
    const c = consigneDonnees(gabarit);
    for (const b of gabarit.blocs) expect(c).toContain(`"${b.id}"`);
    expect(c).toMatch(/STRUCTURE FIGÉE/);
    expect(c).toMatch(/ne s'invente pas/);
  });
});

describe("une génération ramenée à la structure", () => {
  it("garde l'ordre du gabarit même si le modèle mélange les blocs", () => {
    const recu = tableau("80");
    recu.blocks.reverse();
    const r = appliquerDonnees(gabarit, recu)!;
    expect(r.dashboard.blocks.map((b) => b.id)).toEqual(["titre", "chiffres", "detail", "avis"]);
    expect(r.manquants).toEqual([]);
  });

  it("écarte un bloc en trop et signale un bloc absent, sans rien inventer", () => {
    const recu = parseDashboard({
      blocks: [
        { id: "titre", type: "heading", text: "Diagnostic" },
        { id: "chiffres", type: "stats", items: [{ label: "Score", value: "80" }] },
        { id: "bonus", type: "text", body: "Section que personne n'a demandée." },
      ],
    })!;
    const r = appliquerDonnees(gabarit, recu)!;
    expect(r.dashboard.blocks.map((b) => b.id)).toEqual(["titre", "chiffres"]);
    expect(r.manquants).toEqual(["detail", "avis"]);
    expect(r.ecartes).toBe(1);
  });

  it("refuse un bloc dont le type a changé", () => {
    const recu = parseDashboard({
      blocks: [
        { id: "titre", type: "heading", text: "Diagnostic" },
        { id: "chiffres", type: "text", body: "Score : 80" },
      ],
    })!;
    expect(appliquerDonnees(gabarit, recu)!.manquants).toContain("chiffres");
  });

  it("échoue si rien du gabarit ne revient", () => {
    const recu = parseDashboard({ blocks: [{ id: "x", type: "text", body: "Hors sujet." }] })!;
    expect(appliquerDonnees(gabarit, recu)).toBeNull();
    expect(appliquerDonnees(gabarit, null)).toBeNull();
  });

  it("se lit depuis la réponse brute du modèle", () => {
    const brut = `<!--PINNED: ${JSON.stringify({ dashboard: tableau("91") })}-->`;
    const r = appliquerDonnees(gabarit, extractPinnedDashboard(brut))!;
    expect(JSON.stringify(r.dashboard)).toContain("91");
  });

  it("un bloc non rendu garde son contenu précédent, à sa place", () => {
    const precedent = tableau("72");
    const partiel = appliquerDonnees(gabarit, parseDashboard({ blocks: [{ id: "chiffres", type: "stats", items: [{ label: "Score", value: "80" }] }] }))!;
    const complet = completerAvecPrecedent(partiel.dashboard, precedent, gabarit.blocs.map((b) => b.id));
    expect(complet.blocks.map((b) => b.id)).toEqual(["titre", "chiffres", "detail", "avis"]);
    expect(JSON.stringify(complet.blocks[1])).toContain("80");
    expect(JSON.stringify(complet.blocks[2])).toContain("Lyon");
  });
});

describe("rien n'est écrasé par une mise à jour", () => {
  const base: PinnedArtefact = { enabled: true, title: "Carrière", mission: "m", inputs: [] };

  it("dit ce qui a changé", () => {
    expect(resumeChangement(null, tableau("72"))).toBe("première génération");
    expect(resumeChangement(tableau("72"), tableau("72"))).toBe("aucun changement");
    expect(resumeChangement(tableau("72"), tableau("80"))).toBe("1 bloc mis à jour sur 4");
  });

  it("range le tableau précédent et sait y revenir, puis en revenir", () => {
    const v1 = avecNouveauTableau(base, tableau("72"), "2026-11-10T10:00:00Z");
    expect(v1.versions).toBeUndefined();
    const v2 = avecNouveauTableau(v1, tableau("80"), "2026-11-10T11:00:00Z");
    expect(v2.versions).toHaveLength(1);
    expect(JSON.stringify(v2.versions![0].dashboard)).toContain("72");

    const annule = annulerDerniereMiseAJour(v2)!;
    expect(JSON.stringify(annule.dashboard)).toContain("72");
    expect(annule.generatedAt).toBe("2026-11-10T10:00:00Z");
    const retabli = annulerDerniereMiseAJour(annule)!;
    expect(JSON.stringify(retabli.dashboard)).toContain("80");
    expect(annulerDerniereMiseAJour(v1)).toBeNull();
  });

  it("borne l'historique", () => {
    let p = base;
    for (let i = 0; i < 15; i++) p = avecNouveauTableau(p, tableau(String(i)), `d${i}`);
    expect(p.versions).toHaveLength(MAX_VERSIONS_MINI_APP);
  });
});

describe("ce qui voyage", () => {
  const pinned: PinnedArtefact = {
    enabled: true,
    title: "Carrière",
    mission: "secret",
    inputs: [{ id: "cv", label: "CV", kind: "file", value: "mon CV" }],
    gabarit,
    dashboard: tableau("72"),
    versions: [{ n: 1, resume: "x", dashboard: tableau("60") }],
  };
  const espace = { icon: "🧭", name: "G", gent: "g", artefacts: [], conversations: [], files: [], pinnedArtefact: pinned } as unknown as Espace;

  it("un visiteur ne reçoit ni gabarit, ni tableau, ni versions du créateur", () => {
    const v = espaceForPublicLink(espace).pinnedArtefact!;
    expect(v).not.toHaveProperty("gabarit");
    expect(v).not.toHaveProperty("dashboard");
    expect(v).not.toHaveProperty("versions");
    expect(JSON.stringify(v)).not.toContain("mon CV");
  });

  it("la requête de génération porte le gabarit, pas le tableau ni son historique", () => {
    const r = espaceForPinnedRefresh(espace).pinnedArtefact!;
    expect(r.gabarit).toEqual(gabarit);
    expect(r).not.toHaveProperty("dashboard");
    expect(r).not.toHaveProperty("versions");
  });
});
