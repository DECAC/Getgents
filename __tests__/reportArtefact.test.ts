import { bodyToReportSpec, hasReportBody, reportSpecFromArtefact, reportSpecToAppBlocks, reportSpecToEmailHtml } from "@/lib/reportArtefact";
import type { Artefact } from "@/lib/types";

const ITINERAIRE = `<h4>Aperçu du séjour</h4>
        <div class="row"><span>Parcours</span><b>Lyon → Nice (boucle)</b></div>
        <div class="row"><span>Période</span><b>12 → 19 juillet 2026</b></div>
        <div class="row"><span>Voyageurs</span><b>2 adultes, 2 enfants</b></div>
        <h4>Étapes</h4>
        <ul>
        <li><b>J1 — Lyon.</b> Départ, nuit sur place. Vieux Lyon en soirée.</li>
        <li><b>J2 — Annecy.</b> Lac et vieille ville, baignade possible.</li>
        </ul>
        <p style="font-size:12px;color:var(--muted)">Aucune réservation effectuée par l'assistant.</p>`;

function report(partial: Partial<Artefact> & Pick<Artefact, "id" | "title" | "body">): Artefact {
  return {
    type: "Rapport",
    icon: "📄",
    date: "à l'instant",
    kind: "report",
    ...partial,
  };
}

describe("bodyToReportSpec — ancien HTML gendoc", () => {
  it("transforme les lignes .row en grille étiquette/valeur", () => {
    const spec = bodyToReportSpec(ITINERAIRE);
    expect(spec).not.toBeNull();
    const types = spec!.blocks.map((b) => b.type);
    expect(types).toEqual(["heading", "kv", "heading", "kv", "callout"]);

    const kv = spec!.blocks[1];
    expect(kv.type).toBe("kv");
    if (kv.type === "kv") {
      expect(kv.width).toBe("full");
      expect(kv.items).toEqual([
        { label: "Parcours", value: "Lyon → Nice (boucle)" },
        { label: "Période", value: "12 → 19 juillet 2026" },
        { label: "Voyageurs", value: "2 adultes, 2 enfants" },
      ]);
    }
  });

  it("transforme une liste à puces gras+texte en paires", () => {
    const spec = bodyToReportSpec(ITINERAIRE);
    const steps = spec!.blocks[3];
    expect(steps.type).toBe("kv");
    if (steps.type === "kv") {
      expect(steps.items[0]).toMatchObject({ label: "J1 — Lyon", value: expect.stringContaining("Départ") });
    }
  });

  it("met le pied de page discret dans un encadré", () => {
    const spec = bodyToReportSpec(ITINERAIRE);
    const last = spec!.blocks[spec!.blocks.length - 1];
    expect(last.type).toBe("callout");
    if (last.type === "callout") {
      expect(last.tone).toBe("neutral");
      expect(last.body).toContain("Aucune réservation");
    }
  });
});

describe("bodyToReportSpec — markdown des nouveaux rapports", () => {
  it("découpe titres, paragraphes et tableaux", () => {
    const spec = bodyToReportSpec(
      "## Synthèse\n\nLe dossier est complet.\n\n| Poste | Montant |\n| --- | --- |\n| Hébergement | 620 € |\n"
    );
    expect(spec).not.toBeNull();
    expect(spec!.blocks.some((b) => b.type === "heading" && b.text === "Synthèse")).toBe(true);
    expect(spec!.blocks.some((b) => b.type === "text" && b.body.includes("dossier est complet"))).toBe(true);
    const table = spec!.blocks.find((b) => b.type === "table");
    expect(table).toMatchObject({ type: "table", columns: ["Poste", "Montant"] });
    if (table?.type === "table") {
      expect(table.rows[0]).toEqual(["Hébergement", "620 €"]);
    }
  });

  it("garde un texte sans titre", () => {
    const spec = bodyToReportSpec("Bonjour, voici la note.");
    expect(spec!.blocks).toEqual([{ type: "text", width: "full", body: "Bonjour, voici la note." }]);
  });
});

describe("hasReportBody / reportSpecFromArtefact", () => {
  it("ne s'applique qu'aux rapports textuels", () => {
    const a = report({ id: "a1", title: "Itinéraire", body: ITINERAIRE });
    expect(hasReportBody(a)).toBe(true);
    expect(reportSpecFromArtefact(a)?.blocks.length).toBeGreaterThan(0);

    expect(hasReportBody({ ...a, type: "Checklist", kind: "checklist" })).toBe(false);
    expect(hasReportBody({ ...a, dashboard: { blocks: [{ type: "heading", text: "x" }] } })).toBe(false);
    expect(hasReportBody({ ...a, imageUrl: "https://x" })).toBe(false);
  });
});

describe("reportSpecToEmailHtml", () => {
  it("reprend titres et paires dans le HTML d'e-mail", () => {
    const spec = bodyToReportSpec(ITINERAIRE)!;
    const html = reportSpecToEmailHtml(spec, "Itinéraire — road trip");
    expect(html).toContain("Itinéraire — road trip");
    expect(html).toContain("Parcours");
    expect(html).toContain("Lyon → Nice (boucle)");
    expect(html).toContain("Aperçu du séjour");
    expect(html).not.toContain("class=\"row\"");
  });
});

/**
 * Retour de test : « la mise à jour des rapports vers le nouveau design n'est
 * que partielle, je n'obtiens pas tout à fait le même rendu que les autres
 * tuiles ». Trois pertes à la conversion en blocs de tuile : le markdown
 * s'affichait littéralement, les grilles étiquette/valeur portaient un bandeau
 * d'en-tête vide, et les graphiques disparaissaient purement et simplement.
 */
describe("rapport rendu en tuile", () => {
  it("ne laisse pas passer le markdown en clair", () => {
    const spec = bodyToReportSpec("## Le **bilan**\n\nUn [lien](https://x.fr) et du *relief*.")!;
    const blocks = reportSpecToAppBlocks(spec);
    const texte = JSON.stringify(blocks);
    expect(texte).not.toContain("**");
    expect(texte).not.toContain("](");
    expect(blocks[0]).toEqual({ kind: "heading", text: "Le bilan" });
  });

  it("garde le graphique d'un tableau de bord", () => {
    const blocks = reportSpecToAppBlocks({
      blocks: [
        {
          type: "chart",
          variant: "bar",
          title: "Prix au m²",
          xKey: "name",
          data: [
            { name: "Bien", prix: 6800 },
            { name: "Marché", prix: 7100 },
          ],
          series: [{ key: "prix", label: "Prix" }],
        },
      ],
    });
    expect(blocks).toEqual([
      {
        kind: "chart",
        caption: "Prix au m²",
        series: [
          { label: "Bien", value: 6800 },
          { label: "Marché", value: 7100 },
        ],
      },
    ]);
  });

  it("rend une grille étiquette/valeur sans en-tête", () => {
    const blocks = reportSpecToAppBlocks({
      blocks: [{ type: "kv", title: "Détail", items: [{ label: "Surface", value: "72 m²" }] }],
    });
    expect(blocks[0]).toEqual({ kind: "heading", text: "Détail" });
    // Colonnes vides : la tuile n'affiche alors aucun bandeau de titres.
    expect(blocks[1]).toMatchObject({ kind: "table", columns: ["", ""] });
  });
});
