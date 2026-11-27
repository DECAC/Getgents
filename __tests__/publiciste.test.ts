import {
  consignePubliciste,
  extraireStoryboard,
  texteADire,
  validerStoryboard,
  voixMistral,
  MARQUEUR_STORYBOARD,
  MARQUEUR_STORYBOARD_FIN,
  DUREE_FILM_MAX,
} from "@/lib/publiciste";
import { calendrier, nomFichierFilm, paliersMusique, sceneA, sousTitreA, lignesSousTitre, AVANCE_VOIX } from "@/lib/filmRendu";

const sb = (scenes: unknown[]) => JSON.stringify({ titre: "Le premier couteau", scenes });
const s = (titre: string, duree: number, voix = "") => ({ titre, duree, voit: "un atelier", voix, son: "" });

describe("storyboard du Publiciste", () => {
  it("retire le bloc de la réponse et le rend validé", () => {
    const raw = `Voici l'histoire.\n\n${MARQUEUR_STORYBOARD}\n${sb([s("L'atelier", 7, "J'avais huit ans."), s("Le couteau", 8)])}\n${MARQUEUR_STORYBOARD_FIN}`;
    const r = extraireStoryboard(raw);
    expect(r.text).toBe("Voici l'histoire.");
    expect(r.storyboard?.titre).toBe("Le premier couteau");
    expect(r.storyboard?.scenes).toHaveLength(2);
  });

  it("garde la DERNIÈRE version quand il y en a plusieurs", () => {
    const raw = `${MARQUEUR_STORYBOARD}${sb([s("A", 5), s("B", 5)])}${MARQUEUR_STORYBOARD_FIN} puis ${MARQUEUR_STORYBOARD}${sb([s("C", 5), s("D", 5), s("E", 5)])}${MARQUEUR_STORYBOARD_FIN}`;
    expect(extraireStoryboard(raw).storyboard?.scenes.map((x) => x.titre)).toEqual(["C", "D", "E"]);
  });

  it("accepte un JSON entouré d'une clôture de code", () => {
    const raw = `${MARQUEUR_STORYBOARD}\n\`\`\`json\n${sb([s("A", 5), s("B", 5)])}\n\`\`\`\n${MARQUEUR_STORYBOARD_FIN}`;
    expect(extraireStoryboard(raw).storyboard).toBeDefined();
  });

  it("retire un bloc illisible ou coupé sans l'afficher", () => {
    expect(extraireStoryboard(`Texte ${MARQUEUR_STORYBOARD}{pas du json}${MARQUEUR_STORYBOARD_FIN}`)).toEqual({ text: "Texte" });
    expect(extraireStoryboard(`Texte\n${MARQUEUR_STORYBOARD}\n{"titre": "co`)).toEqual({ text: "Texte" });
  });

  it("borne les durées, nettoie les textes, refuse moins de deux scènes", () => {
    const v = validerStoryboard({ titre: "  X ", scenes: [{ titre: "", duree: 99, voit: "a\n b", voix: "" }, { titre: "B", duree: "0,5", voix: "Bonjour" }] });
    expect(v?.scenes[0]).toMatchObject({ titre: "Scène 1", duree: 20, voit: "a b" });
    expect(v?.scenes[1].duree).toBe(2);
    expect(validerStoryboard({ scenes: [s("A", 5)] })).toBeNull();
    expect(validerStoryboard("rien")).toBeNull();
  });

  it("raccourcit par la fin un film trop long", () => {
    const v = validerStoryboard({ scenes: Array.from({ length: 15 }, (_, i) => s(`S${i}`, 20)) });
    expect(v!.scenes.reduce((a, x) => a + x.duree, 0)).toBeLessThanOrEqual(DUREE_FILM_MAX);
  });

  it("la consigne fixe la forme et nomme les marqueurs", () => {
    const c = consignePubliciste();
    expect(c).toContain(MARQUEUR_STORYBOARD);
    expect(c).toContain(MARQUEUR_STORYBOARD_FIN);
    expect(c).toContain("Atelier du film");
  });

  it("ne transmet jamais de points de suspension à la synthèse", () => {
    expect(texteADire("Une voiture, qui roulait… à peu près.")).toBe("Une voiture, qui roulait, à peu près.");
    expect(texteADire("Et puis...")).toBe("Et puis.");
    expect(voixMistral("marie")).toMatch(/^[0-9a-f-]{36}$/);
    expect(voixMistral("inconnue")).toBeNull();
  });
});

describe("calendrier du film", () => {
  const scenes = [s("A", 6, "Une phrase."), s("B", 4), s("C", 3, "Une phrase bien plus longue que la scène.")];

  it("place les scènes bout à bout et la voix après une courte avance", () => {
    const c = calendrier(scenes, [2, undefined, 5]);
    expect(c.scenes[0]).toMatchObject({ debut: 0, fin: 6, voixDebut: AVANCE_VOIX, voixDuree: 2, allongee: false });
    expect(c.scenes[1]).toMatchObject({ debut: 6, fin: 10 });
    expect(c.scenes[1].voixDebut).toBeUndefined();
  });

  it("allonge une scène dont la voix ne tient pas, sans jamais la couper", () => {
    const c = calendrier(scenes, [2, undefined, 5]);
    expect(c.scenes[2].allongee).toBe(true);
    expect(c.scenes[2].fin - c.scenes[2].debut).toBeCloseTo(5.9);
    expect(c.total).toBeCloseTo(15.9);
  });

  it("ignore une voix générée pour une scène dont le texte a été vidé", () => {
    const c = calendrier([s("A", 5, ""), s("B", 5)], [3, undefined]);
    expect(c.scenes[0].voixDebut).toBeUndefined();
  });

  it("dit quelle scène et quel sous-titre afficher", () => {
    const c = calendrier(scenes, [2, undefined, 5]);
    expect(sceneA(c, 0)).toBe(0);
    expect(sceneA(c, 6.5)).toBe(1);
    expect(sceneA(c, 999)).toBe(2);
    expect(sousTitreA(c, scenes, 1)).toBe("Une phrase.");
    expect(sousTitreA(c, scenes, 7)).toBe("");
  });

  it("baisse la musique sous chaque voix, et l'éteint à la fin", () => {
    const c = calendrier(scenes, [2, undefined, 5]);
    const p = paliersMusique(c);
    expect(p.filter(([, g]) => g === 0.28)).toHaveLength(2);
    expect(p[p.length - 1][1]).toBeLessThan(0.01);
  });

  it("coupe les sous-titres en lignes", () => {
    expect(lignesSousTitre("un deux trois quatre", 9, (x) => x.length)).toEqual(["un deux", "trois", "quatre"]);
  });

  it("nomme le fichier d'après le titre, sans accents", () => {
    expect(nomFichierFilm("Le premier couteau !", new Date(2026, 10, 27))).toBe("le-premier-couteau-2026-11-27.mp4");
  });
});
