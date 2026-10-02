import {
  alignerMots,
  decouperSousTitres,
  debutsDePhrases,
  enveloppeMusique,
  facteurZoom,
  motAffiche,
  niveauxParTrame,
  poidsMot,
  reglagesValides,
  remplacerTexte,
  repartirLignes,
  segmentsParole,
  sousTitreA,
  STYLES_HABILLAGE,
  ZOOM_SERRE,
  ATTENUATION_SOUS_VOIX,
  PAS_ANALYSE,
  type MotTemps,
} from "@/lib/habillage";
import { partition, frequence } from "@/lib/musiqueHabillage";

/** Niveaux de trame : `motif` = suite de [durée en s, niveau]. */
function niveaux(motif: [number, number][]): number[] {
  return motif.flatMap(([d, n]) => Array(Math.round(d / PAS_ANALYSE)).fill(n));
}

describe("parole dans la piste son", () => {
  it("mesure le niveau par trame", () => {
    const n = niveauxParTrame([1, -1, 1, -1, 0, 0, 0, 0], 100, 0.04);
    expect(n).toEqual([1, 0]);
  });

  it("repère les phrases et ignore les respirations et les clics", () => {
    const s = segmentsParole(
      niveaux([
        [0.5, 0.002], // silence d'entrée
        [1.0, 0.2], // phrase
        [0.1, 0.002], // respiration : ne coupe pas
        [0.8, 0.2],
        [0.6, 0.002], // vrai silence
        [0.06, 0.3], // clic : ignoré
        [0.6, 0.002],
        [1.2, 0.15],
        [0.4, 0.002],
      ])
    );
    expect(s).toHaveLength(2);
    expect(s[0].debut).toBeCloseTo(0.5, 1);
    expect(s[0].fin).toBeCloseTo(2.4, 1);
    expect(s[1].debut).toBeCloseTo(3.66, 1);
  });

  it("ne voit pas de parole dans un silence", () => {
    expect(segmentsParole(niveaux([[3, 0.001]]))).toEqual([]);
  });
});

describe("calage des mots", () => {
  it("pèse les mots à leurs syllabes", () => {
    expect(poidsMot("intelligence")).toBeGreaterThan(poidsMot("IA"));
    expect(poidsMot("trouve")).toBe(poidsMot("trou")); // e muet
  });

  it("répartit les mots dans la parole, jamais dans les silences", () => {
    const mots = "Bonjour à tous. Voici ma capsule.".split(" ");
    const cales = alignerMots(mots, [
      { debut: 1, fin: 2 },
      { debut: 3, fin: 4.5 },
    ], 6);
    expect(cales[0].debut).toBeCloseTo(1, 2);
    expect(cales[cales.length - 1].fin).toBeCloseTo(4.5, 2);
    for (const m of cales) {
      const dansSilence = m.debut > 2 + 1e-6 && m.debut < 3 - 1e-6;
      expect(dansSilence).toBe(false);
      expect(m.fin).toBeGreaterThan(m.debut);
    }
    // Ordre chronologique.
    cales.slice(1).forEach((m, i) => expect(m.debut).toBeGreaterThanOrEqual(cales[i].debut));
  });

  it("sans parole détectée, étale le texte sur la vidéo", () => {
    const cales = alignerMots(["un", "deux", "trois"], [], 9);
    expect(cales[0].debut).toBeLessThan(0.5);
    expect(cales[2].fin).toBeGreaterThan(8);
  });
});

describe("sous-titres", () => {
  const m = (mot: string, debut: number, fin: number): MotTemps => ({ mot, debut, fin });

  it("coupe aux fins de phrase, aux virgules et à cinq mots", () => {
    const mots = [
      m("L'IA", 0, 0.3),
      m("ne", 0.3, 0.4),
      m("remplace", 0.4, 0.8),
      m("personne.", 0.8, 1.2),
      m("Mais,", 1.5, 1.7),
      m("ceux", 1.7, 1.9),
      m("qui", 1.9, 2),
      m("s'en", 2, 2.2),
      m("servent,", 2.2, 2.6),
      m("si", 2.6, 2.8),
    ];
    const blocs = decouperSousTitres(mots);
    expect(blocs.map((b) => b.mots.map((x) => x.mot).join(" "))).toEqual([
      "L'IA ne remplace personne.",
      "Mais, ceux qui s'en servent,",
      "si",
    ]);
    // Un sous-titre ne chevauche jamais le suivant.
    expect(blocs[0].fin).toBeLessThanOrEqual(blocs[1].debut);
    expect(sousTitreA(blocs, 1.0)?.mots[0].mot).toBe("L'IA");
    expect(sousTitreA(blocs, 99)).toBeNull();
  });

  it("affiche les mots sans ponctuation de fin, sauf ? et !", () => {
    expect(motAffiche("personne.")).toBe("personne");
    expect(motAffiche("servent,")).toBe("servent");
    expect(motAffiche("vraiment ?")).toBe("vraiment ?");
    expect(motAffiche("demain !")).toBe("demain !");
  });

  it("remplace le texte d'un sous-titre dans son créneau", () => {
    const bloc = decouperSousTitres([m("Bonjour", 1, 1.5), m("tous.", 1.5, 2)])[0];
    const nouveau = remplacerTexte(bloc, "Bonjour à toutes et à tous.");
    expect(nouveau.mots).toHaveLength(6);
    expect(nouveau.mots[0].debut).toBeCloseTo(1, 2);
    expect(nouveau.mots[5].fin).toBeCloseTo(2, 2);
  });

  it("répartit sur deux lignes au plus, sans perdre de mot", () => {
    const mesure = (t: string) => t.length * 10;
    expect(repartirLignes(["un", "deux", "trois", "quatre"], mesure, 100)).toEqual([["un", "deux"], ["trois", "quatre"]]);
    const long = repartirLignes("a b c d e f g h".split(" "), mesure, 30);
    expect(long).toHaveLength(2);
    expect(long.flat()).toHaveLength(8);
  });
});

describe("effets", () => {
  it("zoome une phrase sur deux, par une bascule rapide", () => {
    const debuts = debutsDePhrases([
      { mot: "Un.", debut: 0, fin: 1 },
      { mot: "Deux", debut: 2, fin: 2.5 },
      { mot: "trois.", debut: 2.5, fin: 3 },
      { mot: "Quatre.", debut: 4, fin: 5 },
    ]);
    expect(debuts).toEqual([0, 2, 4]);
    expect(facteurZoom(1, debuts)).toBe(1);
    expect(facteurZoom(2.05, debuts)).toBeGreaterThan(1);
    expect(facteurZoom(2.05, debuts)).toBeLessThan(ZOOM_SERRE);
    expect(facteurZoom(3, debuts)).toBeCloseTo(ZOOM_SERRE, 5);
    expect(facteurZoom(5, debuts)).toBeCloseTo(1, 5);
  });
});

describe("musique sous la voix", () => {
  it("entre en fondu, baisse sous la voix, sort en fondu", () => {
    const pts = enveloppeMusique([{ debut: 2, fin: 5 }, { debut: 8, fin: 10 }], 14, 0.5, true);
    const a = (t: number) => {
      let g = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        if (t >= pts[i].t && t <= pts[i + 1].t) {
          const r = (t - pts[i].t) / (pts[i + 1].t - pts[i].t);
          g = pts[i].g + (pts[i + 1].g - pts[i].g) * r;
        }
      }
      return g;
    };
    expect(pts[0]).toEqual({ t: 0, g: 0 });
    expect(pts[pts.length - 1]).toEqual({ t: 14, g: 0 });
    expect(a(1.5)).toBeCloseTo(0.5, 5); // avant la voix
    expect(a(3.5)).toBeCloseTo(0.5 * ATTENUATION_SOUS_VOIX, 5); // sous la voix
    expect(a(6.5)).toBeCloseTo(0.5, 5); // silence entre deux phrases
    expect(a(9)).toBeCloseTo(0.5 * ATTENUATION_SOUS_VOIX, 5);
    pts.slice(1).forEach((p, i) => expect(p.t).toBeGreaterThan(pts[i].t));
  });

  it("ne remonte pas à chaque respiration", () => {
    const pts = enveloppeMusique([{ debut: 1, fin: 3 }, { debut: 3.5, fin: 6 }], 10, 0.5, true);
    const remontees = pts.filter((p) => p.t > 3 && p.t < 3.5 && p.g === 0.5);
    expect(remontees).toHaveLength(0);
  });

  it("sans atténuation, garde le volume", () => {
    const pts = enveloppeMusique([{ debut: 1, fin: 3 }], 10, 0.4, false);
    expect(pts.filter((p) => p.g > 0 && p.g < 0.4)).toHaveLength(0);
  });

  it("écrit une partition qui couvre la vidéo, sans la dépasser", () => {
    for (const style of ["inspirant", "energique", "lofi", "corporate"] as const) {
      const notes = partition(style, 30);
      expect(notes.length).toBeGreaterThan(20);
      expect(Math.max(...notes.map((n) => n.t))).toBeGreaterThan(25);
      expect(notes.every((n) => n.t + n.duree <= 30 + 1e-9 && n.force > 0 && n.force <= 1)).toBe(true);
    }
    expect(frequence(69)).toBe(440);
  });
});

describe("styles", () => {
  it("chaque style est un réglage complet et valide", () => {
    for (const s of STYLES_HABILLAGE) expect(reglagesValides(s.reglages, s.reglages)).toEqual(s.reglages);
  });

  it("relit des réglages abîmés sans planter, et n'invente pas de couleur", () => {
    const r = reglagesValides({ accent: "#ff00ff", volumeMusique: 7, sousTitres: "karaoke", musique: "importee" });
    expect(r.accent).toBe(STYLES_HABILLAGE[0].reglages.accent);
    expect(r.volumeMusique).toBe(STYLES_HABILLAGE[0].reglages.volumeMusique);
    expect(r.musique).toBe(STYLES_HABILLAGE[0].reglages.musique);
    expect(r.sousTitres).toBe("karaoke");
    expect(reglagesValides(null)).toEqual(STYLES_HABILLAGE[0].reglages);
  });
});

import { motsDuTexte } from "@/lib/habillage";

describe("ponctuation à la française", () => {
  it("rattache ? ! : ; au mot qui précède", () => {
    expect(motsDuTexte("Et demain ? Résultat : un rapport « prêt » !")).toEqual([
      "Et",
      "demain ?",
      "Résultat :",
      "un",
      "rapport",
      "« prêt » !",
    ]);
  });

  it("une fin de phrase française coupe le sous-titre, et s'affiche proprement", () => {
    const blocs = decouperSousTitres(alignerMots(motsDuTexte("Et vous, qu'allez-vous lui confier demain ? Bonne journée."), [], 6));
    expect(blocs.map((b) => b.mots.map((m) => m.mot).join(" "))).toEqual([
      "Et vous,",
      "qu'allez-vous lui confier",
      "demain\u00a0?", // 30 caractères au plus : un sous-titre se lit d'un coup d'œil
      "Bonne journée.",
    ]);
    expect(motAffiche("Résultat :")).toBe("Résultat");
    expect(motAffiche("demain ?")).toBe("demain ?");
  });
});
