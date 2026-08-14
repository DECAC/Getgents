import {
  inferArtefactKind,
  kindFromTypeLabel,
} from "@/lib/artefactKind";
import type { Artefact } from "@/lib/types";
import {
  artefactSharePayload,
  keptArtefactModuleId,
  parseEmailRecipients,
  withKeptArtefacts,
} from "@/lib/workspaceArtefacts";
import { convertArtefactToKind } from "@/lib/artefactConversion";
import type { AppPreviewSpec } from "@/lib/appPreview";
import { upsertArtefactThemeTab } from "@/lib/themeTabSignal";

function artef(partial: Partial<Artefact> & Pick<Artefact, "id" | "title">): Artefact {
  return {
    type: "Rapport",
    icon: "📄",
    date: "à l'instant",
    ...partial,
  };
}

const PREVIEW: AppPreviewSpec = {
  appName: "Radar",
  themes: ["Mon profil", "Postes"],
  modules: [
    {
      id: "mini-cv",
      title: "Mini CV",
      theme: "Mon profil",
      size: "large",
      blocks: [{ kind: "text", text: "Profil" }],
    },
  ],
};

describe("withKeptArtefacts", () => {
  it("laisse l'aperçu intact s'il n'y a aucun artefact", () => {
    expect(withKeptArtefacts(PREVIEW, [])).toEqual(PREVIEW);
  });

  it("ajoute une tuile et un onglet au nom du type", () => {
    const a = artef({ id: "a1", title: "Note de synthèse", type: "Rapport", body: "<p>Hello</p>" });
    const next = withKeptArtefacts(PREVIEW, [a]);
    expect(next.themes).toEqual(["Mon profil", "Postes", "Rapport"]);
    expect(next.modules).toHaveLength(2);
    expect(next.modules[1]).toMatchObject({
      id: keptArtefactModuleId("a1"),
      title: "Note de synthèse",
      theme: "Rapport",
    });
    expect(next.modules[0].id).toBe("mini-cv");
    expect(next.modules[1].blocks.some((b) => b.kind === "text" && "text" in b && b.text.includes("Hello"))).toBe(true);
  });

  it("réutilise un onglet studio si le type porte le même nom", () => {
    const a = artef({ id: "a1", title: "CV", type: "Mon profil" });
    const next = withKeptArtefacts(PREVIEW, [a]);
    expect(next.themes).toEqual(["Mon profil", "Postes"]);
    expect(next.modules[1].theme).toBe("Mon profil");
  });
});

describe("changement de type", () => {
  it("met à jour le libellé et range l'artefact dans l'onglet du nouveau type", () => {
    const a = artef({ id: "a1", title: "Note", type: "Rapport", kind: "report", body: "- Relire\n- Signer" });
    const next = convertArtefactToKind(a, "checklist");
    expect(next.type).toBe("Checklist");
    expect(next.kind).toBe("checklist");
    expect(next.icon).toBe("✅");
    const tabs = upsertArtefactThemeTab([], next);
    expect(tabs[0].label).toBe("Checklist");
    expect(tabs[0].moduleIds).toEqual(["artef-a1"]);
  });
});

describe("inferArtefactKind", () => {
  it("lit le champ kind, sinon le libellé, sinon le contenu", () => {
    expect(inferArtefactKind(artef({ id: "1", title: "x", kind: "map" }))).toBe("map");
    expect(kindFromTypeLabel("Tableau de bord")).toBe("dashboard");
    expect(inferArtefactKind(artef({ id: "2", title: "x", type: "Inconnu", chartData: [{ label: "A", value: 1 }] }))).toBe(
      "chart"
    );
  });
});

describe("parseEmailRecipients", () => {
  it("accepte plusieurs adresses et signale les invalides", () => {
    const { emails, invalid } = parseEmailRecipients("marie@exemple.fr, pas-un-mail ; paul@exemple.fr\nmarie@exemple.fr");
    expect(emails).toEqual(["marie@exemple.fr", "paul@exemple.fr"]);
    expect(invalid).toEqual(["pas-un-mail"]);
  });
});

describe("artefactSharePayload", () => {
  it("envoie un rapport avec le HTML du nouveau design", () => {
    const payload = artefactSharePayload(
      artef({
        id: "a1",
        title: "Itinéraire",
        type: "Rapport",
        kind: "report",
        body: `<h4>Aperçu</h4><div class="row"><span>Parcours</span><b>Lyon → Nice</b></div>`,
      })
    );
    expect(payload.htmlBody).toContain("Parcours");
    expect(payload.htmlBody).toContain("Lyon → Nice");
    expect(payload.htmlBody).not.toContain('class="row"');
    expect(payload.body).toContain("Lyon");
  });

  it("n'envoie que le contenu de l'artefact", () => {
    const payload = artefactSharePayload(
      artef({
        id: "a1",
        title: "Liste courses",
        type: "Checklist",
        checklistItems: [{ label: "Passeport", checked: true }],
      })
    );
    expect(payload.subject).toBe("Liste courses");
    expect(payload.body).toContain("Passeport");
    expect(payload.body).not.toContain("espace entier");
  });
});
