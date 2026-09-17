import {
  enTension,
  extractEtatJeu,
  franchissements,
  menaceLaPlusProche,
  objectifVictoire,
  tonFin,
  zoneJauge,
} from "@/lib/jeuEtat";
import { SEUILS, type EtatJeuPublic } from "@/lib/elysee2027/types";

const ETAT: EtatJeuPublic = {
  moteur: "elysee-2027",
  tour: 3,
  duree: 8,
  difficulte: "realiste",
  titre: "Monsieur le Président",
  jauges: { bonheur: 47, confiance: 45, pouvoirAchat: 47, finances: 31, cohesion: 50 },
  serieVictoire: 0,
  derniers: [],
};

function bloc(etat: Partial<EtatJeuPublic>): string {
  return `<!--ETAT_JEU: ${JSON.stringify({ ...ETAT, ...etat })}-->`;
}

describe("extractEtatJeu", () => {
  it("retire le bloc du texte visible et rend l'état", () => {
    const { text, etat } = extractEtatJeu(`Conséquence immédiate — tout va bien.\n${bloc({})}`);
    expect(text).toBe("Conséquence immédiate — tout va bien.");
    expect(etat?.tour).toBe(3);
    expect(etat?.jauges.finances).toBe(31);
  });

  it("ne rend aucun état quand il n'y a pas de bloc", () => {
    const { text, etat } = extractEtatJeu("Bonjour.");
    expect(etat).toBeNull();
    expect(text).toBe("Bonjour.");
  });

  // Une réponse diffusée en fragments peut être concaténée par le navigateur :
  // c'est le dernier état qui décrit la partie.
  it("garde le DERNIER bloc quand la réponse en contient plusieurs", () => {
    const { text, etat } = extractEtatJeu(
      `Un tour.\n${bloc({ tour: 3 })}\nPuis un autre.\n${bloc({ tour: 4 })}`
    );
    expect(etat?.tour).toBe(4);
    expect(text).not.toMatch(/ETAT_JEU/);
    expect(text).toMatch(/Un tour\./);
    expect(text).toMatch(/Puis un autre\./);
  });

  it("masque un bloc tronqué sans rien rendre", () => {
    const { text, etat } = extractEtatJeu('Texte visible.\n<!--ETAT_JEU: {"moteur":"elysee');
    expect(etat).toBeNull();
    expect(text).toBe("Texte visible.");
  });

  it("refuse un état incohérent plutôt que d'afficher n'importe quoi", () => {
    // Jauge hors bornes, durée nulle, jauge manquante : trois blocs à jeter.
    const horsBornes = bloc({ jauges: { ...ETAT.jauges, bonheur: 240 } });
    const dureeNulle = bloc({ duree: 0 });
    const incomplet = '<!--ETAT_JEU: {"moteur":"x","tour":1,"duree":8,"jauges":{"bonheur":10}}-->';
    expect(extractEtatJeu(horsBornes).etat).toBeNull();
    expect(extractEtatJeu(dureeNulle).etat).toBeNull();
    expect(extractEtatJeu(incomplet).etat).toBeNull();
  });

  it("accepte des variations négatives dans les deltas", () => {
    const { etat } = extractEtatJeu(
      bloc({ deltas: { bonheur: -4, confiance: 2, pouvoirAchat: 0, finances: -6, cohesion: 3 } })
    );
    expect(etat?.deltas?.finances).toBe(-6);
  });
});

describe("lecture des seuils", () => {
  it("classe les jauges en zone d'alerte, de récompense ou neutre", () => {
    expect(zoneJauge(SEUILS.alerteBasse)).toBe("alerte");
    expect(zoneJauge(SEUILS.alerteBasse + 1)).toBe("normale");
    expect(zoneJauge(SEUILS.alerteHaute)).toBe("recompense");
  });

  it("met le bandeau en tension dès qu'une seule jauge est basse", () => {
    expect(enTension(ETAT)).toBe(false);
    expect(enTension({ ...ETAT, jauges: { ...ETAT.jauges, cohesion: 20 } })).toBe(true);
  });

  it("nomme la catastrophe la plus proche et la marge restante", () => {
    // Finances 31 pour un seuil de tutelle à 5 : 26 points, la plus courte.
    const m = menaceLaPlusProche(ETAT);
    expect(m.issue).toBe("Mise sous tutelle");
    expect(m.marge).toBe(31 - SEUILS.tutelle.max);

    // Cohésion effondrée : la menace change de nature.
    const m2 = menaceLaPlusProche({ ...ETAT, jauges: { ...ETAT.jauges, cohesion: 14 } });
    expect(m2.issue).toBe("Guerre civile");
    expect(m2.marge).toBe(14 - SEUILS.guerreCivile.max);
  });

  it("ne signale que le FRANCHISSEMENT d'un seuil, pas une jauge déjà basse", () => {
    // Cohésion 20 atteinte ce tour depuis 50 : une alerte.
    const passage = franchissements({
      ...ETAT,
      jauges: { ...ETAT.jauges, cohesion: 20 },
      deltas: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: -30 },
    });
    expect(passage).toHaveLength(1);
    expect(passage[0]).toMatchObject({ jauge: "cohesion", sens: "alerte", valeur: 20 });

    // Déjà basse au tour précédent, elle remonte d'un point : plus d'alerte.
    const deja = franchissements({
      ...ETAT,
      jauges: { ...ETAT.jauges, cohesion: 20 },
      deltas: { bonheur: 0, confiance: 0, pouvoirAchat: 0, finances: 0, cohesion: 1 },
    });
    expect(deja).toHaveLength(0);
  });

  it("signale aussi le passage en zone de récompense", () => {
    const passage = franchissements({
      ...ETAT,
      jauges: { ...ETAT.jauges, pouvoirAchat: 78 },
      deltas: { bonheur: 0, confiance: 0, pouvoirAchat: 31, finances: 0, cohesion: 0 },
    });
    expect(passage).toHaveLength(1);
    expect(passage[0]).toMatchObject({ jauge: "pouvoirAchat", sens: "recompense" });
  });

  it("sans variation, aucun franchissement n'est annoncé", () => {
    expect(franchissements(ETAT)).toEqual([]);
  });

  it("suit les deux conditions de victoire et la série en cours", () => {
    const o = objectifVictoire({
      ...ETAT,
      jauges: { ...ETAT.jauges, bonheur: 82, confiance: 71 },
      serieVictoire: 1,
    });
    expect(o).toEqual({
      bonheurAtteint: true,
      confianceAtteinte: true,
      serie: 1,
      requis: SEUILS.victoire.toursConsecutifs,
    });
  });

  it("donne trois tons de fin, et jamais le rouge à un bilan mitigé", () => {
    expect(tonFin("victoire")).toBe("gagnee");
    expect(tonFin("victoire_mandat")).toBe("gagnee");
    expect(tonFin("revolution")).toBe("perdue");
    expect(tonFin("guerre_civile")).toBe("perdue");
    expect(tonFin("tutelle")).toBe("perdue");
    // Fin de mandat ordinaire : ni triomphe, ni catastrophe.
    expect(tonFin("bilan_mitige")).toBe("neutre");
    expect(tonFin(undefined)).toBe("neutre");
  });
});
