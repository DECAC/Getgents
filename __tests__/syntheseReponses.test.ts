import { attendus, csvReponses, listeLisible, ouverturesSurQuatorzeJours, syntheseChoix } from "@/lib/syntheseReponses";
import type { ReponseEngagement } from "@/lib/engagement";

const rep = (o: Partial<ReponseEngagement>): ReponseEngagement => ({
  id: Math.random().toString(36),
  jeton: "j1",
  destinataire: "Camille",
  intitule: "Valider mes choix",
  mot: null,
  choix: [],
  lecture: null,
  invite: null,
  version: 1,
  createdAt: "2026-11-19T15:00:00Z",
  vueAt: null,
  ...o,
});

describe("synthèse des choix", () => {
  it("additionne par section, plus choisis d'abord, avec les noms", () => {
    const s = syntheseChoix([
      rep({ destinataire: "Camille", choix: [{ groupe: "Activités", valeur: "Rando", modifie: true }, { groupe: "Activités", valeur: "Jeux", modifie: true }] }),
      rep({ destinataire: "Paul", invite: "Paul", choix: [{ groupe: "Activités", valeur: "Jeux", modifie: true }] }),
      rep({ destinataire: "Karim", invite: "Karim" }),
    ]);
    expect(s.avecChoix).toBe(2);
    expect(s.groupes[0].options).toEqual([
      { valeur: "Jeux", nombre: 2, qui: ["Camille", "Paul"] },
      { valeur: "Rando", nombre: 1, qui: ["Camille"] },
    ]);
  });
});

describe("réponses attendues", () => {
  it("un lien personnel compte un, un groupe compte ses invités", () => {
    const a = attendus(
      [{ jeton: "j1", destinataire: "Camille" }, { jeton: "g", destinataire: "Les 4 familles" }, { jeton: "j3", destinataire: "Odile" }],
      { g: ["Paul", "Karim", "Sophie", "Léa"] },
      [rep({ jeton: "j1" }), rep({ jeton: "g", invite: "paul" }), rep({ jeton: "g", invite: "Karim" })]
    );
    expect([a.repondus, a.total]).toEqual([3, 6]);
    expect(a.enAttente).toEqual(["Sophie", "Léa", "Odile"]);
    expect(listeLisible(a.enAttente)).toBe("Sophie, Léa et Odile");
  });
});

describe("export et courbe", () => {
  it("le CSV s'ouvre dans Excel et ne porte aucune formule", () => {
    const c = csvReponses([rep({ destinataire: "=HYPERLINK(1)", mot: 'Il a dit "oui"; ok' })]);
    expect(c.startsWith("﻿Date;Nom")).toBe(true);
    expect(c).toContain("'=HYPERLINK(1)");
    expect(c).toContain('"Il a dit ""oui""; ok"');
  });
  it("14 jours, le plus ancien d'abord, à zéro sans ouverture", () => {
    const j = ouverturesSurQuatorzeJours({ "2026-11-19": 7, "2026-11-06": 1, "2026-11-01": 9 }, "2026-11-19");
    expect(j).toHaveLength(14);
    expect(j[0]).toEqual({ jour: "2026-11-06", n: 1 });
    expect(j[13]).toEqual({ jour: "2026-11-19", n: 7 });
  });
});
