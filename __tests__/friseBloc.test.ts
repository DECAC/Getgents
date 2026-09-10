import { parseDashboard, TIMELINE_MAX_ITEMS } from "@/lib/dashboardArtefact";

const bloc = (items: unknown[], extra: Record<string, unknown> = {}) =>
  parseDashboard({ blocks: [{ type: "timeline", title: "Parcours", items, ...extra }] })
    ?.blocks[0] as Extract<
    NonNullable<ReturnType<typeof parseDashboard>>["blocks"][number],
    { type: "timeline" }
  >;

describe("bloc frise", () => {
  it("retient une etape complete", () => {
    const b = bloc([
      { date: "2018 — 2022", label: "Responsable", body: "Texte.", state: "current", tag: "En poste", metric: "+40" },
    ]);
    expect(b.type).toBe("timeline");
    expect(b.items[0]).toEqual({
      date: "2018 — 2022",
      label: "Responsable",
      body: "Texte.",
      state: "current",
      tag: "En poste",
      metric: "+40",
    });
  });

  it("SEUL l'intitule est obligatoire", () => {
    const b = bloc([{ date: "2020", label: "Étape" }, { date: "2021" }, { label: "Sans date" }]);
    // « 2021 » sans intitule tombe ; « Sans date » reste.
    expect(b.items.map((i) => i.label)).toEqual(["Étape", "Sans date"]);
    expect(b.items[1].date).toBeUndefined();
  });

  // Regression : la consigne d'exactitude interdit d'inventer une annee. Le
  // modele obeissait, omettait la date, et la frise entiere disparaissait.
  it("une frise SANS AUCUNE date reste un bloc valable", () => {
    const b = bloc([{ label: "Cegedim" }, { label: "Talentsoft" }, { label: "Pegasystems" }]);
    expect(b.items).toHaveLength(3);
    expect(b.items.every((i) => i.date === undefined)).toBe(true);
  });

  // Arbitrage : un etat absent ou farfelu ne doit pas vider la frise.
  it("un state manquant ou inconnu retombe sur done", () => {
    const b = bloc([{ date: "2020", label: "A" }, { date: "2021", label: "B", state: "n_importe_quoi" }]);
    expect(b.items.map((i) => i.state)).toEqual(["done", "done"]);
  });

  // Arbitrage : plafond ANNONCE, jamais coupe en silence.
  it("plafonne a 12 etapes et annonce les omises", () => {
    const trop = Array.from({ length: 17 }, (_, i) => ({ date: `20${10 + i}`, label: `Étape ${i}` }));
    const b = bloc(trop);
    expect(b.items).toHaveLength(TIMELINE_MAX_ITEMS);
    expect(b.omises).toBe(5);
  });

  it("n'annonce rien quand tout tient", () => {
    expect(bloc([{ date: "2020", label: "A" }]).omises).toBeUndefined();
  });

  // Arbitrage : aucun tri — l'ordre du createur fait foi.
  it("rend les etapes DANS L'ORDRE FOURNI, meme antichronologique", () => {
    const b = bloc([
      { date: "2024", label: "Récent" },
      { date: "2018", label: "Ancien" },
      { date: "2021", label: "Milieu" },
    ]);
    expect(b.items.map((i) => i.label)).toEqual(["Récent", "Ancien", "Milieu"]);
  });

  it("une frise sans etape valable n'est pas un bloc", () => {
    expect(parseDashboard({ blocks: [{ type: "timeline", items: [] }] })).toBeNull();
    expect(parseDashboard({ blocks: [{ type: "timeline", items: "pas un tableau" }] })).toBeNull();
  });
});
