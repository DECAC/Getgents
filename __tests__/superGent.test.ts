import { describeGents, isRoutableGent, resolveRouting, suggestionsFromGents } from "@/lib/superGent";
import type { Espace, EspacesMap } from "@/lib/types";

function gent(patch: Partial<Espace>): Espace {
  return {
    icon: "🧭",
    name: "Un gent",
    gent: "Un gent",
    systemPrompt: "INSTRUCTIONS DU GENT — Tu aides à planifier des voyages.",
    ...patch,
  } as Espace;
}

const espaces: EspacesMap = {
  voyage: gent({ gent: "Compagnon de voyage", starters: ["Où partir en juillet ?", "Quel budget ?"] }),
  emploi: gent({
    gent: "Radar Emploi",
    systemPrompt: "INSTRUCTIONS DU GENT — Tu surveilles le marché de l'emploi.",
    starters: ["Quelles offres de presales ?"],
  }),
};

describe("gents éligibles au routage", () => {
  it("écarte les mini-applications, qui ne conversent pas", () => {
    const miniApp = gent({
      pinnedArtefact: { enabled: true, title: "Tableau", mission: "…", inputs: [] },
    });
    expect(isRoutableGent(miniApp)).toBe(false);
  });

  it("écarte un gent sans instructions (rien à quoi router)", () => {
    expect(isRoutableGent(gent({ systemPrompt: "   " }))).toBe(false);
  });

  it("retient un gent conversationnel configuré", () => {
    expect(isRoutableGent(espaces.voyage)).toBe(true);
  });
});

describe("fiches envoyées au classifieur", () => {
  it("décrit chaque gent par la consigne du créateur, pas par les blocs plateforme", () => {
    const d = describeGents(espaces);
    expect(d).toHaveLength(2);
    expect(d.find((x) => x.id === "voyage")?.summary).toContain("planifier des voyages");
    // Le marqueur de section ne doit pas polluer le résumé.
    expect(d.find((x) => x.id === "voyage")?.summary).not.toContain("INSTRUCTIONS DU GENT");
  });

  it("annonce les capacités réelles du gent (connecteurs, recherche web)", () => {
    const avecOutils = describeGents({
      x: gent({ webSearch: true, prim: true }),
    });
    expect(avecOutils[0].summary).toContain("recherche web");
    expect(avecOutils[0].summary).toContain("transports");
  });
});

describe("idées de questions sous la barre de saisie", () => {
  it("couvre la famille de gents avant de reprendre le même gent", () => {
    const s = suggestionsFromGents(espaces, 5);
    // Un tour par gent d'abord : voyage, emploi, puis le 2e starter de voyage.
    expect(s.map((x) => x.gentId)).toEqual(["voyage", "emploi", "voyage"]);
  });

  it("suit les gents actifs : retirer un gent retire ses questions", () => {
    const s = suggestionsFromGents({ voyage: espaces.voyage }, 5);
    expect(s.every((x) => x.gentId === "voyage")).toBe(true);
  });

  it("ne propose rien quand aucun gent n'a encore de déclencheur", () => {
    expect(suggestionsFromGents({ x: gent({ starters: undefined }) })).toEqual([]);
  });
});

describe("décision de routage", () => {
  const descriptors = describeGents(espaces);

  it("retient le gent désigné par le classifieur", () => {
    const d = resolveRouting('{"gentId":"emploi","reason":"marché du travail"}', descriptors);
    expect(d.gentId).toBe("emploi");
  });

  it("tolère du texte autour du JSON", () => {
    const d = resolveRouting('Voici : {"gentId":"voyage"} — fin', descriptors);
    expect(d.gentId).toBe("voyage");
  });

  it("renvoie null quand aucun gent ne couvre le sujet", () => {
    expect(resolveRouting('{"gentId":null}', descriptors).gentId).toBeNull();
  });

  it("ne force jamais un gent inventé par le modèle", () => {
    // Sans gent en cours : on préfère « aucun » à une réponse hors domaine.
    expect(resolveRouting('{"gentId":"fiscal"}', descriptors).gentId).toBeNull();
  });

  it("retombe sur le gent en cours quand le modèle renvoie un id inconnu", () => {
    expect(resolveRouting('{"gentId":"inconnu"}', descriptors, "voyage").gentId).toBe("voyage");
  });

  it("reste robuste à une sortie illisible", () => {
    expect(resolveRouting("je ne sais pas", descriptors).gentId).toBeNull();
  });
});
