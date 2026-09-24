import { avecIdentifiants, formeDeduite, parseDashboard, resumeComposition, type DashboardSpec } from "@/lib/dashboardArtefact";
import { consigneArtefacts, extractArtefactSignal } from "@/lib/artefactSignal";
import { reportSpecToAppBlocks, reportSpecToEmailHtml } from "@/lib/reportArtefact";

const signal = (json: string) => extractArtefactSignal(`Voici.\n<!--ARTEFACT: ${json}-->`);

describe("vocabulaire unique : nouveaux blocs", () => {
  it("lit une checklist en chaînes nues ou en objets déjà cochés", () => {
    const spec = parseDashboard({
      blocks: [
        { type: "checklist", title: "Départ", items: ["Passeport", "", { label: "Assurance", checked: true }] },
      ],
    });
    expect(spec?.blocks[0]).toMatchObject({
      type: "checklist",
      title: "Départ",
      items: [
        { label: "Passeport", checked: false },
        { label: "Assurance", checked: true },
      ],
    });
  });

  it("lit une carte et écarte les points hors de la Terre ou sans nom", () => {
    const spec = parseDashboard({
      blocks: [
        {
          type: "map",
          points: [
            { label: "Lyon", lat: 45.76, lon: 4.83, description: "Nuit 1" },
            { label: "Nulle part", lat: 123, lon: 4 },
            { lat: 45, lon: 5 },
          ],
        },
      ],
    });
    const carte = spec?.blocks[0];
    expect(carte?.type).toBe("map");
    expect(carte && carte.type === "map" ? carte.points.map((p) => p.label) : []).toEqual(["Lyon"]);
  });
});

describe("identifiants stables des blocs", () => {
  it("garde l'identifiant du modèle s'il est propre et unique, complète sinon", () => {
    const spec = parseDashboard({
      blocks: [
        { id: "intro", type: "text", body: "A" },
        { id: "intro", type: "text", body: "B" },
        { id: "pas un id !", type: "text", body: "C" },
        { type: "text", body: "D" },
      ],
    });
    const ids = spec!.blocks.map((b) => b.id);
    expect(ids[0]).toBe("intro");
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => /^[a-z][a-z0-9_-]*$/i.test(id!))).toBe(true);
  });

  it("n'attribue jamais un bN déjà pris par le modèle", () => {
    const blocs = avecIdentifiants(
      [
        { type: "text", body: "A" },
        { type: "text", body: "B" },
      ],
      [undefined, "b1"]
    );
    expect(blocs.map((b) => b.id)).toEqual(["b2", "b1"]);
  });
});

describe("format unique { title, blocks }", () => {
  it("devient un artefact à blocs, sans « kind » à fournir", () => {
    const r = signal(
      '{"title":"Itinéraire","blocks":[{"type":"map","points":[{"label":"Lyon","lat":45.76,"lon":4.83}]},{"type":"checklist","items":["Réserver"]}]}'
    );
    expect(r.echec).toBeUndefined();
    expect(r.artefact?.kind).toBe("dashboard");
    expect(r.artefact?.dashboard?.blocks.map((b) => b.type)).toEqual(["map", "checklist"]);
  });

  it("des blocs tous invalides : l'artefact est déclaré illisible, pas perdu en silence", () => {
    expect(signal('{"title":"X","blocks":[{"type":"inconnu"}]}').echec).toBe("illisible");
  });

  it("les formes historiques restent lues", () => {
    expect(signal('{"kind":"checklist","title":"Départ","items":["Passeport"]}').artefact?.items).toEqual(["Passeport"]);
  });

  it("le résumé de profil garde son format propre", () => {
    const r = signal('{"kind":"profile-summary","title":"Jeanne","profileSummary":{"name":"Jeanne Martin"}}');
    expect(r.artefact?.kind).toBe("profile-summary");
  });

  it("la consigne n'enseigne plus qu'un seul format", () => {
    const c = consigneArtefacts();
    expect(c).toContain('"blocks":[...]');
    expect(c).not.toContain('"kind":"report"');
    expect(c).not.toContain('"kind":"dashboard"');
  });
});

describe("forme déduite de la composition", () => {
  const spec = (...types: string[]): DashboardSpec =>
    parseDashboard({
      blocks: types.map((t) =>
        t === "checklist"
          ? { type: t, items: ["a"] }
          : t === "timeline"
            ? { type: t, items: [{ label: "a" }] }
            : t === "map"
              ? { type: t, points: [{ label: "a", lat: 1, lon: 1 }] }
              : t === "callout"
                ? { type: t, body: "x" }
                : { type: "text", body: "x" }
      ),
    })!;

  it("un seul genre de bloc porteur donne son nom", () => {
    expect(formeDeduite(spec("checklist"))).toBe("Checklist");
    expect(formeDeduite(spec("timeline", "callout", "text"))).toBe("Frise");
    expect(formeDeduite(spec("map", "text"))).toBe("Carte");
  });

  it("du texte seul est un rapport ; un mélange n'est un tableau de bord que s'il porte des chiffres", () => {
    expect(formeDeduite(spec("text", "callout"))).toBe("Rapport");
    expect(formeDeduite(spec("map", "checklist"))).toBe("Document");
    const chiffre = parseDashboard({
      blocks: [
        { type: "stats", items: [{ label: "Budget", value: "2 800 €" }] },
        { type: "checklist", items: ["a"] },
      ],
    })!;
    expect(formeDeduite(chiffre)).toBe("Tableau de bord");
  });
});

describe("conversions : plus aucun bloc perdu", () => {
  const spec = parseDashboard({
    blocks: [
      { type: "timeline", title: "Parcours", items: [{ date: "2018", label: "Cegedim" }, { label: "Talentsoft" }] },
      { type: "checklist", items: ["Relire", { label: "Signer", checked: true }] },
      { type: "map", points: [{ label: "Lyon", lat: 45.76, lon: 4.83, description: "Nuit 1" }] },
    ],
  })!;

  it("vers le canevas d'aperçu : la frise devient un tableau ordonné", () => {
    const app = reportSpecToAppBlocks(spec);
    expect(app).toContainEqual({ kind: "table", columns: ["Date", "Étape"], rows: [["2018", "Cegedim"], ["", "Talentsoft"]] });
    expect(app).toContainEqual({ kind: "checklist", items: [{ label: "Relire", done: false }, { label: "Signer", done: true }] });
    expect(app).toContainEqual({ kind: "table", columns: ["Lieu", ""], rows: [["Lyon", "Nuit 1"]] });
  });

  it("vers l'e-mail : chaque étape, case et lieu apparaît", () => {
    const html = reportSpecToEmailHtml(spec, "Parcours");
    for (const attendu of ["Cegedim", "Talentsoft", "☐ Relire", "☑ Signer", "Lyon — Nuit 1"]) {
      expect(html).toContain(attendu);
    }
  });
});

describe("résumé de composition", () => {
  it("dit ce que contient l'artefact, dans l'ordre et sans doublon", () => {
    const spec = parseDashboard({
      blocks: [
        { type: "heading", text: "Parcours" },
        { type: "timeline", items: [{ label: "a" }] },
        { type: "callout", body: "x" },
        { type: "map", points: [{ label: "a", lat: 1, lon: 1 }] },
        { type: "checklist", items: ["a"] },
        { type: "callout", body: "y" },
      ],
    })!;
    expect(resumeComposition(spec)).toBe("Frise, encadré, carte et checklist");
  });
});
