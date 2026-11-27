import {
  aRedessiner,
  devisProduction,
  differences,
  dureeVisee,
  fusionnerRevision,
  minutage,
  promptCroquis,
  sceneModifiee,
  validerReponseStoryboard,
  validerStoryboard,
} from "@/lib/publicisteStoryboard";
import { validerEtat, ETAT_VIDE, resumeProjet } from "@/lib/publiciste";

const reponse = (n = 3, prefixe = "s") => ({
  bulle: ["J'ai construit le récit autour du four.", "Corrigez la fin si besoin."],
  scenes: Array.from({ length: n }, (_, i) => ({ id: `${prefixe}${i + 1}`, titre: `Scène ${i + 1}`, duree: 6, voit: `On voit ${i + 1}`, vo: i ? `Phrase ${i + 1}` : "", entend: "", trans: "Fondu" })),
});

describe("Publiciste, lot 4 : storyboard", () => {
  it("valide la réponse du modèle et pose le texte comme origine", () => {
    const r = validerReponseStoryboard(reponse())!;
    expect(r.scenes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(r.scenes[1].origine.vo).toBe("Phrase 2");
    expect(sceneModifiee(r.scenes[1])).toBe(false);
    expect(validerReponseStoryboard({ bulle: ["x"], scenes: [reponse().scenes[0]] })).toBeNull();
    expect(validerReponseStoryboard({ scenes: reponse().scenes })).toBeNull();
  });

  it("ne laisse pas une scène nouvelle d'une révision prendre l'identifiant d'une scène existante", () => {
    const actuelles = validerReponseStoryboard(reponse())!.scenes.map((s) => ({ ...s, croquis: `croquis-${s.id}-a`, dessine: s.voit }));
    const brut = { bulle: ["J'ai ajouté une scène."], scenes: [reponse().scenes[0], { titre: "Nouvelle", duree: 4, voit: "Le four au matin", vo: "", entend: "", trans: "" }, reponse().scenes[2]] };
    const rev = validerReponseStoryboard(brut, true)!;
    expect(rev.scenes[1].id).toBe("n2");
    const fusion = fusionnerRevision(actuelles, rev.scenes);
    expect(fusion[0].croquis).toBe("croquis-s1-a");
    expect(fusion[1].id).toMatch(/^s/);
    expect(actuelles.map((s) => s.id)).not.toContain(fusion[1].id);
    expect(aRedessiner(fusion[1])).toBe(true);
    expect(aRedessiner(fusion[2])).toBe(false);
    const d = differences(actuelles, fusion);
    expect(d.ajoutees).toEqual(["Nouvelle"]);
    expect(d.supprimees).toEqual(["Scène 2"]);
    expect(d.aDessiner).toBe(1);
  });

  it("redessine une scène gardée dont « On voit » a changé", () => {
    const a = validerReponseStoryboard(reponse())!.scenes.map((s) => ({ ...s, croquis: `croquis-${s.id}-a`, dessine: s.voit }));
    const f = fusionnerRevision(a, a.map((s, i) => (i === 0 ? { ...s, voit: "Autre chose" } : s)));
    expect(f.filter(aRedessiner).map((s) => s.id)).toEqual(["s1"]);
    expect(differences(a, f).modifiees).toEqual(["Scène 1"]);
  });

  it("garde le storyboard à l'aller-retour de l'état, et la validation", () => {
    const sb = { ...validerReponseStoryboard(reponse())!, commentaire: "Plus court" };
    sb.scenes[0] = { ...sb.scenes[0], voit: "corrigé", croquis: "croquis-s1-x", dessine: "On voit 1", coutCroquis: 0.034 };
    const e = validerEtat({ ...ETAT_VIDE, storyboard: sb, valide: true, voix: { texte: "", extraits: {}, ecartees: [], lignes: { charon: { s2: { fichier: "voix-charon-1", texte: "Phrase 2" }, "../x": { fichier: "voix-a-1" } } } } })!;
    expect(e.storyboard?.scenes[0].voit).toBe("corrigé");
    expect(e.storyboard?.scenes[0].origine.voit).toBe("On voit 1");
    expect(e.storyboard?.scenes[0].croquis).toBe("croquis-s1-x");
    expect(e.storyboard?.commentaire).toBe("Plus court");
    expect(Object.keys(e.voix?.lignes?.charon ?? {})).toEqual(["s2"]);
    expect(resumeProjet(e).statut).toBe("validee");
    expect(validerStoryboard({ scenes: "x" })).toBeUndefined();
  });

  it("lit la durée visée dans la forme", () => {
    expect(dureeVisee("Un film d'une minute")).toBe(60);
    expect(dureeVisee("Film court de 45 s pour Instagram")).toBe(45);
    expect(dureeVisee("vidéo de 1,5 min")).toBe(90);
    expect(dureeVisee(undefined)).toBe(60);
  });

  it("allonge une scène dont la réplique est plus longue que prévu", () => {
    const m = minutage([{ duree: 3, vo: "Une longue phrase" }, { duree: 5, vo: "" }], [4, null]);
    expect(m[0]).toEqual({ debut: 0, fin: 5, voix: 0.4 });
    expect(m[1]).toEqual({ debut: 5, fin: 10, voix: null });
  });

  it("demande des croquis grossiers, sans texte", () => {
    expect(promptCroquis("Un four", "Atelier chaud")).toMatch(/crayon graphite.*aucun texte.*Ambiance du film : Atelier chaud.*Scène : Un four/);
  });

  it("estime la production d'après le nombre de scènes", () => {
    expect(devisProduction(10)[0].libelle).toMatch(/≈ 15 dessins/);
    expect(devisProduction(10)[3].cout).toBeNull();
  });
});
