import {
  appliquerOperations,
  contexteArtefacts,
  lireOperations,
  resoudreRetouche,
  versBlocs,
} from "@/lib/operationsBlocs";
import { avecNouvelleVersion, MAX_VERSIONS, numeroVersion, restaurerVersion } from "@/lib/versionsArtefact";
import { extractArtefactSignal } from "@/lib/artefactSignal";
import { avecContexteEspace, historiquePourModele } from "@/lib/historiqueModele";
import { parseDashboard, type DashboardSpec } from "@/lib/dashboardArtefact";
import type { Artefact } from "@/lib/types";

const frise: DashboardSpec = parseDashboard({
  blocks: [
    { id: "b1", type: "heading", text: "Parcours" },
    { id: "b2", type: "timeline", title: "Étapes", items: [{ label: "Cegedim" }] },
    { id: "b3", type: "callout", title: "À noter", body: "Dates partielles." },
  ],
})!;

function artef(partial: Partial<Artefact> = {}): Artefact {
  return { id: "artef-1", title: "Parcours professionnel", type: "Frise", icon: "📈", date: "hier", kind: "dashboard", dashboard: frise, ...partial };
}

describe("lecture des opérations", () => {
  it("écarte une opération mal formée sans rejeter les autres", () => {
    const ops = lireOperations([
      { op: "supprimer", bloc: "b3" },
      { op: "modifier", bloc: "b2", avec: { type: "inconnu" } },
      { op: "exploser", bloc: "b1" },
      { op: "deplacer", bloc: "pas un id !" },
    ]);
    expect(ops).toEqual([{ op: "supprimer", bloc: "b3" }]);
  });

  it("rien de valide : null", () => {
    expect(lireOperations([{ op: "modifier", bloc: "b2" }])).toBeNull();
    expect(lireOperations("pas une liste")).toBeNull();
  });
});

describe("application des opérations", () => {
  it("modifie UN bloc et laisse les autres strictement identiques", () => {
    const ops = lireOperations([
      { op: "modifier", bloc: "b2", avec: { type: "timeline", title: "Étapes", items: [{ label: "Cegedim" }, { label: "Talentsoft" }] } },
    ])!;
    const r = appliquerOperations(frise, ops)!;
    expect(r.spec.blocks[0]).toEqual(frise.blocks[0]);
    expect(r.spec.blocks[2]).toEqual(frise.blocks[2]);
    expect(r.spec.blocks[1]).toMatchObject({ id: "b2", type: "timeline" });
    expect(r.blocsTouches).toEqual(["b2"]);
    expect(r.resume).toBe("« Étapes » modifié");
  });

  it("ajoute après un bloc, en tête ou à la fin, avec un identifiant libre", () => {
    const ops = lireOperations([
      { op: "ajouter", apres: "b1", bloc: { type: "text", body: "Intro" } },
      { op: "ajouter", apres: "debut", bloc: { id: "b2", type: "text", body: "Tout début" } },
      { op: "ajouter", bloc: { id: "fin", type: "checklist", items: ["Relire"] } },
    ])!;
    const r = appliquerOperations(frise, ops)!;
    const ids = r.spec.blocks.map((b) => b.id);
    expect(ids[0]).not.toBe("b2");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(1, 3)).toEqual(["b1", "b4"]);
    expect(ids[ids.length - 1]).toBe("fin");
  });

  it("supprime et déplace", () => {
    const r = appliquerOperations(
      frise,
      lireOperations([
        { op: "deplacer", bloc: "b3", apres: "debut" },
        { op: "supprimer", bloc: "b1" },
      ])!
    )!;
    expect(r.spec.blocks.map((b) => b.id)).toEqual(["b3", "b2"]);
    expect(r.resume).toBe("« À noter » déplacé, « Parcours » supprimé");
  });

  it("n'invente rien : un bloc introuvable est ignoré et compté", () => {
    const r = appliquerOperations(
      frise,
      lireOperations([
        { op: "supprimer", bloc: "b9" },
        { op: "supprimer", bloc: "b3" },
      ])!
    )!;
    expect(r.ignorees).toBe(1);
    expect(r.spec.blocks.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("aucune opération applicable : null, jamais un artefact vide", () => {
    expect(appliquerOperations(frise, lireOperations([{ op: "supprimer", bloc: "b9" }])!)).toBeNull();
    const toutSupprimer = lireOperations(["b1", "b2", "b3"].map((bloc) => ({ op: "supprimer", bloc })))!;
    expect(appliquerOperations(frise, toutSupprimer)).toBeNull();
  });
});

describe("les artefacts historiques deviennent retouchables", () => {
  it("checklist, graphique et carte passent en blocs", () => {
    const spec = versBlocs(
      artef({
        dashboard: undefined,
        kind: "checklist",
        checklistItems: [{ label: "Passeport", checked: true }],
        chartData: [{ label: "A", value: 1 }],
        mapPoints: [{ label: "Lyon", lat: 45.7, lon: 4.8 }],
      })
    )!;
    expect(spec.blocks.map((b) => b.type)).toEqual(["checklist", "chart", "map"]);
    expect(spec.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("un résumé de profil ou une image ne se retouchent pas par blocs", () => {
    expect(versBlocs(artef({ dashboard: undefined, imageUrl: "https://x/y.png" }))).toBeNull();
  });
});

describe("résolution d'une retouche", () => {
  const ops = lireOperations([{ op: "supprimer", bloc: "b3" }])!;

  it("trouve l'artefact par identifiant, à défaut par titre", () => {
    expect(resoudreRetouche([artef()], "artef-1", ops)?.modification?.artefactId).toBe("artef-1");
    expect(resoudreRetouche([artef()], "parcours PROFESSIONNEL", ops)?.title).toBe("Parcours professionnel");
  });

  it("artefact absent : null — l'appelant l'annonce", () => {
    expect(resoudreRetouche([artef()], "artef-inconnu", ops)).toBeNull();
  });
});

describe("contexte envoyé au modèle", () => {
  it("décrit chaque bloc avec son identifiant", () => {
    const c = contexteArtefacts([artef()]);
    expect(c).toContain('artefact "artef-1" « Parcours professionnel »');
    expect(c).toContain('"id":"b2"');
  });

  it("au-delà du budget, un bloc n'est plus décrit que par son identifiant", () => {
    const gros = parseDashboard({
      blocks: Array.from({ length: 8 }, (_, i) => ({ id: `b${i + 1}`, type: "text", body: "x".repeat(900) })),
    })!;
    const c = contexteArtefacts([artef({ dashboard: gros })]);
    expect(c).toContain('{"id":"b8","type":"text"} (contenu omis)');
    expect(c.length).toBeLessThan(4_000);
  });

  it("est joint au DERNIER message de l'utilisateur, balisé", () => {
    const h = avecContexteEspace(
      [
        { role: "user", content: "Bonjour" },
        { role: "assistant", content: "Salut" },
        { role: "user", content: "Ajoute 2020" },
      ],
      "- artefact ..."
    );
    expect(h[0].content).toBe("Bonjour");
    expect(h[2].content.startsWith("[ESPACE]")).toBe(true);
    expect(h[2].content.endsWith("Ajoute 2020")).toBe(true);
  });

  it("rien à retoucher : l'historique est inchangé", () => {
    const h = [{ role: "user" as const, content: "Bonjour" }];
    expect(avecContexteEspace(h, "")).toBe(h);
  });
});

describe("signal de retouche", () => {
  it("lit { cible, operations }", () => {
    const r = extractArtefactSignal('Fait.\n<!--ARTEFACT: {"cible":"artef-1","operations":[{"op":"supprimer","bloc":"b3"}]}-->');
    expect(r.artefact?.cible).toBe("artef-1");
    expect(r.artefact?.operations).toEqual([{ op: "supprimer", bloc: "b3" }]);
    expect(r.text).toBe("Fait.");
  });

  it("des opérations toutes invalides : illisible, annoncé", () => {
    expect(extractArtefactSignal('<!--ARTEFACT: {"cible":"artef-1","operations":[{"op":"x"}]}-->').echec).toBe("illisible");
  });

  it("la mémoire dit si une modification a été appliquée", () => {
    const h = historiquePourModele([
      { role: "agent", text: "Fait." },
      {
        id: "p",
        role: "artef-proposal",
        proposalStatus: "added",
        proposal: {
          kind: "dashboard",
          title: "Parcours professionnel",
          modification: { artefactId: "artef-1", resume: "« À noter » supprimé", blocsTouches: [], ignorees: 0 },
        },
      },
    ]);
    expect(h[0].content).toContain("[Modification proposée de « Parcours professionnel » : « À noter » supprimé — appliquée]");
  });
});

describe("versions", () => {
  it("range l'état précédent et garde l'identifiant", () => {
    const avant = artef();
    const apres = avecNouvelleVersion(avant, artef({ id: "autre", title: "Parcours v2" }), "« Étapes » modifié", "24/09 10:00");
    expect(apres.id).toBe("artef-1");
    expect(apres.versions?.[0]).toMatchObject({ n: 1, resume: "« Étapes » modifié" });
    expect(apres.versions?.[0].contenu.title).toBe("Parcours professionnel");
    expect(numeroVersion(apres)).toBe(2);
  });

  it("restaurer ne détruit rien : l'état actuel rejoint l'historique", () => {
    const v2 = avecNouvelleVersion(artef(), artef({ title: "Parcours v2" }), "modifié", "t1");
    const retour = restaurerVersion(v2, 1, "t2")!;
    expect(retour.title).toBe("Parcours professionnel");
    expect(retour.versions?.[0]).toMatchObject({ n: 2, resume: "retour à la version 1" });
    expect(retour.versions?.[0].contenu.title).toBe("Parcours v2");
    expect(numeroVersion(retour)).toBe(3);
  });

  it("borne l'historique", () => {
    let a = artef();
    for (let i = 0; i < MAX_VERSIONS + 5; i += 1) a = avecNouvelleVersion(a, artef({ title: `v${i}` }), "x", "t");
    expect(a.versions).toHaveLength(MAX_VERSIONS);
    expect(numeroVersion(a)).toBe(MAX_VERSIONS + 6);
  });
});

describe("cohérence : un ajout du même genre se fond dans le bloc existant", () => {
  // Vécu : « ajoute Maltem avant Cegedim » a produit une SECONDE frise
  // « Parcours » au lieu d'une étape de plus.
  const parcours = parseDashboard({
    blocks: [
      { id: "b1", type: "timeline", title: "Parcours", items: [{ label: "Cegedim" }, { label: "Talentsoft" }] },
      { id: "b2", type: "callout", body: "Note" },
    ],
  })!;

  it("placé en tête, l'ajout met ses étapes en tête de la frise existante", () => {
    const r = appliquerOperations(
      parcours,
      lireOperations([{ op: "ajouter", apres: "debut", bloc: { type: "timeline", title: "Parcours", items: [{ label: "Maltem", tag: "Non vérifié" }] } }])!
    )!;
    expect(r.spec.blocks).toHaveLength(2);
    const frise = r.spec.blocks[0];
    expect(frise.type === "timeline" ? frise.items.map((i) => i.label) : []).toEqual(["Maltem", "Cegedim", "Talentsoft"]);
    expect(r.resume).toBe("« Parcours » complété");
    expect(r.blocsTouches).toEqual(["b1"]);
  });

  it("placé après, l'ajout complète à la fin, sans doublon", () => {
    const r = appliquerOperations(
      parcours,
      lireOperations([{ op: "ajouter", bloc: { type: "timeline", items: [{ label: "Talentsoft" }, { label: "Getgents" }] } }])!
    )!;
    const frise = r.spec.blocks[0];
    expect(frise.type === "timeline" ? frise.items.map((i) => i.label) : []).toEqual(["Cegedim", "Talentsoft", "Getgents"]);
  });

  it("un autre titre reste un bloc distinct : la fusion ne devine pas", () => {
    const r = appliquerOperations(
      parcours,
      lireOperations([{ op: "ajouter", bloc: { type: "timeline", title: "Formation", items: [{ label: "ESCP" }] } }])!
    )!;
    expect(r.spec.blocks).toHaveLength(3);
  });

  it("un tableau aux mêmes colonnes reçoit des lignes, pas un second tableau", () => {
    const t = parseDashboard({ blocks: [{ id: "t", type: "table", columns: ["Poste", "Coût"], rows: [["Vol", "300"]] }] })!;
    const r = appliquerOperations(
      t,
      lireOperations([{ op: "ajouter", bloc: { type: "table", columns: ["poste", "coût"], rows: [["Hôtel", "500"]] } }])!
    )!;
    expect(r.spec.blocks).toHaveLength(1);
    const tab = r.spec.blocks[0];
    expect(tab.type === "table" ? tab.rows : []).toEqual([["Vol", "300"], ["Hôtel", "500"]]);
  });

  it("la consigne demande de modifier le bloc, pas d'en ajouter un second", () => {
    expect(extractArtefactSignal).toBeDefined();
    const { consigneArtefacts } = jest.requireActual("@/lib/artefactSignal");
    expect(consigneArtefacts()).toContain("n'ajoute JAMAIS un second bloc du même genre");
  });
});
