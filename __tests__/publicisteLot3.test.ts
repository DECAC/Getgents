import {
  coutDirection,
  dureeWav,
  promptMusique,
  texteSansSuspension,
  validerProposition,
  validerVoix,
  texteEssaiParDefaut,
  TEXTE_ESSAI_MAX,
} from "@/lib/publicisteDirection";
import { validerEtat, ETAT_VIDE } from "@/lib/publiciste";
import { pcmEnWav } from "@/lib/server/gemini";
import { voixAutorisee, VOIX_PAR_HEURE } from "@/lib/server/limiteVoix";

const musique = () => ({
  bulle: ["J'ai traduit l'émotion.", "Je recommande le souvenir."],
  recommandee: "souvenir",
  pistes: ["souvenir", "ete", "geste"].map((id) => ({ id, nom: `Piste ${id}`, ressenti: "Une tendresse", demande: "Guitare acoustique · 66 bpm" })),
});

describe("Publiciste, lot 3 : musique et voix", () => {
  it("valide trois pistes de musique et ne garde qu'un nom d'extrait bien formé", () => {
    const b = musique() as ReturnType<typeof musique> & { pistes: Array<Record<string, unknown>> };
    b.pistes[0].audio = "musique-souvenir-abc";
    b.pistes[1].audio = "../../secret";
    const p = validerProposition("musique", b);
    expect(p?.musique?.map((x) => x.audio)).toEqual(["musique-souvenir-abc", undefined, undefined]);
    expect(p?.recommandee).toBe("souvenir");
  });

  it("demande TOUJOURS un morceau instrumental (sans quoi Lyria chante)", () => {
    expect(promptMusique({ demande: "Piano", ressenti: "calme" })).toMatch(/^Morceau INSTRUMENTAL, sans aucune voix/);
  });

  it("compte les extraits de musique dans le coût", () => {
    const p = validerProposition("musique", musique())!;
    p.musique![0].cout = 0.04;
    p.musique![1].cout = 0.04;
    expect(coutDirection({ musique: p }, 0.02).total).toBe(0.1);
  });

  it("valide l'état des voix : voix connues, fichiers bien formés, jeu de la liste", () => {
    const v = validerVoix({
      texte: "x".repeat(400),
      extraits: { charon: { fichier: "voix-charon-1", texte: "a" }, inconnue: { fichier: "voix-x-1" }, kore: { fichier: "../x" }, "ma-voix": { fichier: "voix-ma-voix-2", texte: "b" } },
      ecartees: ["puck", "puck", "zz"],
      jeu: "confie",
    })!;
    expect(v.texte.length).toBe(TEXTE_ESSAI_MAX);
    expect(Object.keys(v.extraits).sort()).toEqual(["charon", "ma-voix"]);
    expect(v.ecartees).toEqual(["puck"]);
    expect(v.jeu).toBe("confie");
    expect(validerVoix({ jeu: "inventé" })?.jeu).toBeUndefined();
  });

  it("garde les voix à l'aller-retour de l'état du projet", () => {
    const etat = validerEtat({ ...ETAT_VIDE, etape: "voix", choix: { voix: "ma-voix" }, voix: { texte: "Bonjour", extraits: { leda: { fichier: "voix-leda-9", texte: "Bonjour" } }, ecartees: [] } });
    expect(etat?.choix.voix).toBe("ma-voix");
    expect(etat?.voix?.extraits.leda?.fichier).toBe("voix-leda-9");
  });

  it("tire un texte d'essai du projet", () => {
    expect(texteEssaiParDefaut({ etiquette: "", titre: "Le premier couteau", corps: "", fin: "Offrez une histoire.", bouton: "" }, "", "")).toBe("Le premier couteau Offrez une histoire.");
    expect(texteEssaiParDefaut(undefined, "Acme", "")).toMatch(/Acme/);
  });

  it("retire les points de suspension, qui font improviser Voxtral", () => {
    expect(texteSansSuspension("Une voiture qui roulait… à peu près.")).toBe("Une voiture qui roulait, à peu près.");
    expect(texteSansSuspension("Fin...")).toBe("Fin.");
  });

  it("lit la durée d'un WAV, et refuse ce qui n'en est pas un", () => {
    const wav = pcmEnWav(new Uint8Array(24000 * 2 * 3), 24000);
    expect(dureeWav(wav)).toBeCloseTo(3, 5);
    expect(dureeWav(new Uint8Array(100))).toBeNull();
    expect(dureeWav(new TextEncoder().encode("RIFF....WAVE" + " ".repeat(40)))).toBeNull();
  });

  it("plafonne les voix par heure et par compte", () => {
    const t = 1_000_000;
    for (let i = 0; i < VOIX_PAR_HEURE; i++) expect(voixAutorisee("u-test", t + i)).toBe(true);
    expect(voixAutorisee("u-test", t + 100)).toBe(false);
    expect(voixAutorisee("autre", t)).toBe(true);
    expect(voixAutorisee("u-test", t + 3_600_001)).toBe(true);
  });
});
