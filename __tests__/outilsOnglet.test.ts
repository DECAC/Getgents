import { artefactDepuisBlocs } from "@/lib/operationsBlocs";
import { clesPerimees, cleOnglet, DUREE_VIE_ONGLET_MS, ID_ONGLET, lireMessageOnglet, nouvelIdOnglet } from "@/lib/ongletArtefact";
import { parseDashboard } from "@/lib/dashboardArtefact";
import type { Artefact } from "@/lib/types";

const checklistHistorique: Artefact = {
  id: "a1",
  title: "Départ",
  type: "Checklist",
  icon: "✅",
  date: "hier",
  kind: "checklist",
  checklistItems: [{ label: "Passeport", checked: true }],
};

describe("édition à la main", () => {
  it("convertit l'artefact en blocs et efface le format historique", () => {
    const spec = parseDashboard({ blocks: [{ type: "checklist", items: [{ label: "Passeport", checked: true }, "Visa"] }] })!;
    const apres = artefactDepuisBlocs(checklistHistorique, spec, "  Départ   en voyage ")!;
    expect(apres.id).toBe("a1");
    expect(apres.title).toBe("Départ en voyage");
    expect(apres.kind).toBe("dashboard");
    expect(apres.checklistItems).toBeUndefined();
    expect(apres.type).toBe("Checklist");
  });

  it("repasse par la validation : un bloc vidé disparaît, un artefact vidé est refusé", () => {
    const vide = { blocks: [{ type: "text" as const, body: "" }] };
    expect(artefactDepuisBlocs(checklistHistorique, vide, "X")).toBeNull();
  });

  it("garde un accent de la palette, écarte une couleur libre", () => {
    expect(parseDashboard({ accent: "prune", blocks: [{ type: "text", body: "a" }] })?.accent).toBe("prune");
    expect(parseDashboard({ accent: "#ff0000", blocks: [{ type: "text", body: "a" }] })?.accent).toBeUndefined();
  });
});

describe("artefact ouvert dans un autre onglet", () => {
  const message = (cree: number) =>
    JSON.stringify({ v: 1, espaceId: "shared", artefact: checklistHistorique, source: "espace", maj: cree, cree });

  it("identifiant imprévisible et accepté par la page", () => {
    const id = nouvelIdOnglet();
    expect(ID_ONGLET.test(id)).toBe(true);
    expect(nouvelIdOnglet()).not.toBe(id);
  });

  it("lit un message valide, refuse le reste", () => {
    expect(lireMessageOnglet(message(1))?.artefact.id).toBe("a1");
    expect(lireMessageOnglet("{")).toBeNull();
    expect(lireMessageOnglet(JSON.stringify({ v: 1, espaceId: "x" }))).toBeNull();
  });

  it("purge les copies périmées ou illisibles, et seulement elles", () => {
    const maintenant = 10 * DUREE_VIE_ONGLET_MS;
    const cles = clesPerimees(
      [
        [cleOnglet("recent"), message(maintenant - 1000)],
        [cleOnglet("ancien"), message(maintenant - DUREE_VIE_ONGLET_MS - 1)],
        [cleOnglet("casse"), "{"],
        ["getgents:visiteur:x", "{"],
      ],
      maintenant
    );
    expect(cles.sort()).toEqual([cleOnglet("ancien"), cleOnglet("casse")].sort());
  });
});

describe("option du studio : modification des artefacts par les utilisateurs", () => {
  const { draftToEspace } = jest.requireActual("@/lib/publishedGents");
  const { espaceForPublicLink } = jest.requireActual("@/lib/espaceApiPayload");
  const brouillon = (partial: Record<string, unknown> = {}) => ({
    id: "g1",
    name: "Talk to Charles",
    icon: "✨",
    objective: "présenter Charles",
    systemPrompt: "Tu es l'avatar de Charles.",
    status: "draft",
    updatedAt: "à l'instant",
    modelAssignments: [],
    knowledgeSources: [],
    connectors: [],
    builderConversation: [],
    ...partial,
  });

  it("désactivée par défaut", () => {
    expect(draftToEspace(brouillon()).artefactsModifiables).toBeUndefined();
  });

  it("activée, elle atteint le navigateur du visiteur", () => {
    const espace = draftToEspace(brouillon({ artefactsModifiables: true }));
    expect(espaceForPublicLink(espace).artefactsModifiables).toBe(true);
  });
});
