import { parseDashboard } from "@/lib/dashboardArtefact";
import { extractArtefactSignal } from "@/lib/artefactSignal";

describe("parseDashboard", () => {
  it("valide un tableau de bord complet et coerce les types", () => {
    const spec = parseDashboard({
      subtitle: "Analyse",
      blocks: [
        { type: "stats", items: [{ label: "Prix", value: "685 000 €", delta: "-2%", trend: "down" }] },
        { type: "heading", text: "Section" },
        { type: "kv", items: [{ label: "Surface", value: "153 m²" }] },
        { type: "callout", tone: "warning", body: "attention" },
        { type: "chart", variant: "composed", xKey: "mois", series: [{ key: "v", label: "Ventes", type: "bar" }], data: [{ mois: "Jan", v: 3 }] },
        { type: "table", columns: ["A", "B"], rows: [["1", "2"]] },
      ],
    });
    expect(spec).not.toBeNull();
    expect(spec!.blocks).toHaveLength(6);
    expect(spec!.blocks[0].type).toBe("stats");
    expect(spec!.blocks[4]).toMatchObject({ type: "chart", variant: "composed" });
  });

  it("rejette un bloc chart sans data ou sans series", () => {
    const spec = parseDashboard({ blocks: [{ type: "chart", variant: "bar", series: [], data: [] }] });
    expect(spec).toBeNull();
  });

  it("retombe sur des valeurs sûres (tone invalide → info, variant invalide → bar)", () => {
    const spec = parseDashboard({
      blocks: [
        { type: "callout", tone: "explosif", body: "x" },
        { type: "chart", variant: "camembert", series: [{ key: "a", label: "A" }], data: [{ label: "L", a: 1 }] },
      ],
    });
    expect(spec!.blocks[0]).toMatchObject({ type: "callout", tone: "info" });
    expect(spec!.blocks[1]).toMatchObject({ type: "chart", variant: "bar" });
  });

  it("ignore les valeurs de données non numériques/non textuelles", () => {
    const spec = parseDashboard({
      blocks: [{ type: "chart", variant: "bar", series: [{ key: "a", label: "A" }], data: [{ label: "L", a: 5, junk: { x: 1 } }] }],
    });
    const chart = spec!.blocks[0] as Extract<(typeof spec)["blocks"][number], { type: "chart" }>;
    expect(chart.data[0]).toEqual({ label: "L", a: 5 });
  });
});

describe("extractArtefactSignal — kind dashboard", () => {
  it("extrait un artefact dashboard depuis le bloc ARTEFACT", () => {
    const raw =
      "Voici l'analyse.\n\n<!--ARTEFACT: " +
      JSON.stringify({
        kind: "dashboard",
        title: "Analyse maison",
        dashboard: { blocks: [{ type: "stats", items: [{ label: "Prix", value: "685 000 €" }] }] },
      }) +
      "-->";
    const { text, artefact } = extractArtefactSignal(raw);
    expect(text).toBe("Voici l'analyse.");
    expect(artefact).not.toBeNull();
    expect(artefact!.kind).toBe("dashboard");
    expect(artefact!.dashboard!.blocks).toHaveLength(1);
  });

  it("ignore un dashboard sans blocs valides", () => {
    const raw = '<!--ARTEFACT: {"kind":"dashboard","title":"Vide","dashboard":{"blocks":[]}}-->';
    const { artefact } = extractArtefactSignal(raw);
    expect(artefact!.kind).toBe("dashboard");
    expect(artefact!.dashboard).toBeUndefined();
  });
});
